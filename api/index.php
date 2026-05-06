<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$uri  = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = preg_replace('#^/api#', '', $uri);
$method = $_SERVER['REQUEST_METHOD'];

match (true) {
    $path === '/tests'        && $method === 'GET'  => handleListTests(),
    $path === '/run'          && $method === 'POST' => handleRun(),
    $path === '/codegen'      && $method === 'POST' => handleCodegen(),
    $path === '/file-content' && $method === 'GET'  => handleFileContent(),
    default => respond(404, ['error' => 'Endpoint not found']),
};

// ─── handlers ────────────────────────────────────────────────────────────────

function handleListTests(): void
{
    $testsDir = realpath(__DIR__ . '/../tests');

    if (!$testsDir || !is_dir($testsDir)) {
        respond(200, ['files' => []]);
        return;
    }

    $files    = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($testsDir));

    foreach ($iterator as $file) {
        if (!$file->isFile()) continue;
        if (!str_contains($file->getFilename(), '.spec.')) continue;
        if (!in_array($file->getExtension(), ['ts', 'js'])) continue;

        $content      = file_get_contents($file->getPathname());
        $relativePath = ltrim(str_replace($testsDir, '', $file->getPathname()), DIRECTORY_SEPARATOR);
        $relativePath = str_replace(DIRECTORY_SEPARATOR, '/', $relativePath);

        preg_match_all('/\btest\s*\(\s*[\'"](.+?)[\'"]/m', $content, $testMatches);
        preg_match_all('/\bdescribe\s*\(\s*[\'"](.+?)[\'"]/m', $content, $descMatches);

        $files[] = [
            'path'     => $relativePath,
            'name'     => $file->getFilename(),
            'category' => $descMatches[1][0] ?? pathinfo($file->getFilename(), PATHINFO_FILENAME),
            'tests'    => $testMatches[1],
        ];
    }

    usort($files, fn($a, $b) => strcmp($a['path'], $b['path']));
    respond(200, ['files' => $files]);
}

function handleRun(): void
{
    $body          = json_decode(file_get_contents('php://input'), true) ?? [];
    $selectedFiles = $body['files']   ?? [];
    $options       = $body['options'] ?? [];

    if (empty($selectedFiles)) {
        respond(400, ['error' => 'Nie wybrano żadnych testów.']);
        return;
    }

    $projectRoot = realpath(__DIR__ . '/..');
    $testsDir    = realpath($projectRoot . '/tests');

    $fileParts = [];
    $grepParts = [];

    foreach ($selectedFiles as $fileData) {
        $path  = is_array($fileData) ? ($fileData['path']  ?? '') : $fileData;
        $tests = is_array($fileData) ? ($fileData['tests'] ?? null) : null;

        $abs = realpath($testsDir . '/' . ltrim($path, '/'));
        if (!$abs || !str_starts_with($abs, $testsDir)) continue;

        $fileParts[] = escapeshellarg($abs);

        if (!empty($tests)) {
            foreach ($tests as $t) {
                $grepParts[] = preg_quote($t, '/');
            }
        }
    }

    if (empty($fileParts)) {
        respond(400, ['error' => 'Nie znaleziono wybranych plików testów.']);
        return;
    }

    // ── Switch to SSE streaming ──────────────────────────────────────────────
    while (ob_get_level() > 0) ob_end_clean();

    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('X-Accel-Buffering: no');
    header('Connection: keep-alive');

    $headed  = !empty($options['headed']);
    $jsonTmp = tempnam(sys_get_temp_dir(), 'pw_json_');
    $fileArg = implode(' ', $fileParts);

    $env = array_merge(getenv() ?: [], [
        'PLAYWRIGHT_JSON_OUTPUT_NAME' => $jsonTmp,
        'FORCE_COLOR'                 => '0',
        'CI'                          => $headed ? '0' : '1',
        'DISPLAY'                     => getenv('DISPLAY') ?: ':99',
    ]);

    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $cmd = 'npx playwright test ' . $fileArg . ' --reporter=json,list';
    if (!empty($grepParts)) {
        $cmd .= ' --grep ' . escapeshellarg(implode('|', $grepParts));
    }
    if ($headed) {
        $cmd .= ' --headed';
    }
    $proc = proc_open($cmd, $descriptors, $pipes, $projectRoot, $env);

    if (!is_resource($proc)) {
        sseEvent('error', ['message' => 'Nie udało się uruchomić procesu Playwright']);
        return;
    }

    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    $start = microtime(true);

    while (true) {
        $status = proc_get_status($proc);

        $out = fread($pipes[1], 65536);
        $err = fread($pipes[2], 65536);
        $chunk = ($out ?: '') . ($err ?: '');

        if ($chunk !== '') {
            foreach (explode("\n", $chunk) as $line) {
                sseData($line);
            }
            flush();
        }

        if (!$status['running']) break;

        usleep(100000); // 100 ms poll
    }

    // Drain remaining output
    stream_set_blocking($pipes[1], true);
    stream_set_blocking($pipes[2], true);
    $tail = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
    if ($tail !== '') {
        foreach (explode("\n", $tail) as $line) {
            sseData($line);
        }
        flush();
    }

    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($proc);
    $duration = (int) round((microtime(true) - $start) * 1000);

    // Read JSON results written by json reporter
    $results = null;
    if (file_exists($jsonTmp)) {
        $raw     = file_get_contents($jsonTmp);
        $results = json_decode($raw, true);
        if ($results === null) {
            $pos     = strpos($raw, '{');
            $results = $pos !== false ? json_decode(substr($raw, $pos), true) : null;
        }
        unlink($jsonTmp);
    }

    sseEvent('done', [
        'exitCode' => $exitCode,
        'duration' => $duration,
        'success'  => $exitCode === 0,
        'results'  => $results,
    ]);
    flush();
}

function handleCodegen(): void
{
    $body     = json_decode(file_get_contents('php://input'), true) ?? [];
    $url      = trim($body['url']      ?? '');
    $filename = trim($body['filename'] ?? '');

    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        respond(400, ['error' => 'Nieprawidłowy URL.']);
        return;
    }

    // Sanitize filename: only alphanumeric, dash, underscore
    $filename = preg_replace('/[^a-z0-9\-_]/i', '-', $filename);
    $filename = trim($filename, '-') ?: 'nowy-test';
    if (!str_ends_with($filename, '.spec.ts')) {
        $filename .= '.spec.ts';
    }

    $projectRoot = realpath(__DIR__ . '/..');
    $outputDir   = $projectRoot . '/tests/panel';
    $outputPath  = $outputDir . '/' . $filename;

    if (!is_dir($outputDir)) mkdir($outputDir, 0755, true);

    if (file_exists($outputPath)) {
        respond(409, ['error' => "Plik $filename już istnieje. Wybierz inną nazwę."]);
        return;
    }

    // ── SSE streaming ────────────────────────────────────────────────────────
    while (ob_get_level() > 0) ob_end_clean();
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('X-Accel-Buffering: no');
    header('Connection: keep-alive');

    sseData('🎬 Uruchamianie Playwright Codegen…');
    sseData('🌐 Otwieranie: ' . $url);
    sseData('📝 Plik wynikowy: tests/panel/' . $filename);
    sseData('');
    sseData('👆 Klikaj po stronie — wszystkie akcje są nagrywane.');
    sseData('🛑 Zamknij przeglądarkę gdy skończysz.');
    flush();

    $cmd = 'npx playwright codegen '
        . escapeshellarg($url)
        . ' --output ' . escapeshellarg($outputPath)
        . ' --target playwright-test';

    $env         = array_merge(getenv() ?: [], [
        'FORCE_COLOR' => '0',
        'DISPLAY'     => getenv('DISPLAY') ?: ':99',
    ]);
    $descriptors = [0 => ['pipe','r'], 1 => ['pipe','w'], 2 => ['pipe','w']];
    $proc        = proc_open($cmd, $descriptors, $pipes, $projectRoot, $env);

    if (!is_resource($proc)) {
        sseEvent('error', ['message' => 'Nie udało się uruchomić playwright codegen']);
        return;
    }

    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    while (true) {
        $status = proc_get_status($proc);
        $chunk  = (fread($pipes[1], 65536) ?: '') . (fread($pipes[2], 65536) ?: '');
        if ($chunk !== '') {
            foreach (explode("\n", $chunk) as $line) sseData($line);
            flush();
        }
        if (!$status['running']) break;
        usleep(200000);
    }

    stream_set_blocking($pipes[1], true);
    stream_set_blocking($pipes[2], true);
    $tail = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
    if ($tail) { foreach (explode("\n", $tail) as $l) sseData($l); }

    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($proc);
    $exists   = file_exists($outputPath);

    if ($exists) {
        sseData('');
        sseData('✅ Nagrywanie zakończone — plik zapisany.');
    } else {
        sseData('');
        sseData('⚠ Plik nie został zapisany (przeglądarka zamknięta za wcześnie?).');
    }

    sseEvent('done', [
        'exitCode' => $exitCode,
        'success'  => $exists,
        'filename' => $filename,
        'path'     => 'panel/' . $filename,
    ]);
    flush();
}

function handleFileContent(): void
{
    $relPath  = $_GET['path'] ?? '';
    $testsDir = realpath(__DIR__ . '/../tests');

    if (!$testsDir || $relPath === '') {
        respond(400, ['error' => 'Brak ścieżki.']);
        return;
    }

    $abs = realpath($testsDir . '/' . ltrim($relPath, '/'));
    if (!$abs || !str_starts_with($abs, $testsDir) || !is_file($abs)) {
        respond(404, ['error' => 'Plik nie istnieje.']);
        return;
    }

    respond(200, ['content' => file_get_contents($abs)]);
}

// ─── SSE helpers ─────────────────────────────────────────────────────────────

function sseData(string $line): void
{
    echo 'data: ' . json_encode($line, JSON_UNESCAPED_UNICODE) . "\n\n";
}

function sseEvent(string $event, array $data): void
{
    echo 'event: ' . $event . "\n";
    echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
}

// ─── JSON helper (for non-streaming endpoints) ────────────────────────────────

function respond(int $status, array $data): void
{
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
