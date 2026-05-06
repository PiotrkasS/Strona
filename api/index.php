<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$uri  = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = preg_replace('#^/api#', '', $uri);
$method = $_SERVER['REQUEST_METHOD'];

match (true) {
    $path === '/tests'         && $method === 'GET'    => handleListTests(),
    $path === '/tests'         && $method === 'DELETE' => handleDeleteTest(),
    $path === '/run'           && $method === 'POST'   => handleRun(),
    $path === '/codegen'       && $method === 'POST'   => handleCodegen(),
    $path === '/file-content'  && $method === 'GET'    => handleFileContent(),
    $path === '/file-content'  && $method === 'PUT'    => handleSaveFile(),
    $path === '/ai-fix'        && $method === 'POST'   => handleAiFix(),
    $path === '/close-browser' && $method === 'POST'   => handleCloseBrowser(),
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

        // Skip empty or huge files
        $size = $file->getSize();
        if ($size === 0 || $size > 2_000_000) continue;

        $content = @file_get_contents($file->getPathname());
        if ($content === false) continue;

        $relativePath = ltrim(str_replace($testsDir, '', $file->getPathname()), DIRECTORY_SEPARATOR);
        $relativePath = str_replace(DIRECTORY_SEPARATOR, '/', $relativePath);

        // Safe regex: limit match length, no catastrophic backtracking
        preg_match_all('/\btest\s*\(\s*[\'"]([^\'"]{1,300})[\'"]/m', $content, $testMatches);
        preg_match_all('/\bdescribe\s*\(\s*[\'"]([^\'"]{1,300})[\'"]/m', $content, $descMatches);

        // Also match it('...') style
        preg_match_all('/\bit\s*\(\s*[\'"]([^\'"]{1,300})[\'"]/m', $content, $itMatches);
        $allTests = array_values(array_unique(array_merge($testMatches[1], $itMatches[1])));

        $files[] = [
            'path'     => $relativePath,
            'name'     => $file->getFilename(),
            'category' => $descMatches[1][0] ?? pathinfo($file->getFilename(), PATHINFO_FILENAME),
            'tests'    => $allTests ?: ['(brak named testów)'],
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

    $headed     = !empty($options['headed']);
    $pauseAfter = !empty($options['pauseAfter']);
    $slowMo     = max(0, (int)($options['slowMo'] ?? 0));
    $jsonTmp    = tempnam(sys_get_temp_dir(), 'pw_json_');
    $fileArg    = implode(' ', $fileParts);

    $env = array_merge(getenv() ?: [], [
        'PLAYWRIGHT_JSON_OUTPUT_NAME' => $jsonTmp,
        'FORCE_COLOR'                 => '0',
        'CI'                          => $headed ? '0' : '1',
        'DISPLAY'                     => getenv('DISPLAY') ?: ':99',
        'PW_SLOW_MO'                  => $slowMo > 0 ? (string)$slowMo : '0',
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

    // If pauseAfter requested, open a review browser window and notify client
    if ($pauseAfter && $headed) {
        $display = getenv('DISPLAY') ?: ':99';
        $baseUrl = getenv('BASE_URL') ?: 'about:blank';
        $pidFile = '/tmp/pw-review.pid';
        $logFile = '/tmp/pw-review.log';
        $pid = trim(shell_exec(
            'DISPLAY=' . escapeshellarg($display) .
            ' nohup npx playwright open ' . escapeshellarg($baseUrl) .
            ' --headed > ' . escapeshellarg($logFile) . ' 2>&1 & echo $!'
        ));
        if (is_numeric($pid)) {
            file_put_contents($pidFile, $pid);
        }
        sseEvent('paused', ['pid' => (int)$pid]);
        flush();
    }
}

function handleCloseBrowser(): void
{
    $pidFile = '/tmp/pw-review.pid';
    $pid = trim(@file_get_contents($pidFile) ?: '');
    if ($pid && is_numeric($pid)) {
        shell_exec("kill $pid 2>/dev/null; pkill -P $pid 2>/dev/null; true");
        @unlink($pidFile);
    }
    // Kill any remaining playwright open / chromium review processes
    shell_exec('pkill -f "playwright open" 2>/dev/null; true');
    respond(200, ['ok' => true]);
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

    $codegenScript = file_exists('/codegen-start.sh') ? '/codegen-start.sh' : null;
    if ($codegenScript) {
        $cmd = 'bash ' . $codegenScript
            . ' ' . escapeshellarg($url)
            . ' ' . escapeshellarg($outputPath);
    } else {
        $cmd = 'npx playwright codegen '
            . escapeshellarg($url)
            . ' --output ' . escapeshellarg($outputPath)
            . ' --target playwright-test';
    }

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

function handleDeleteTest(): void
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

    if (!str_contains($abs, '.spec.')) {
        respond(400, ['error' => 'Można usuwać tylko pliki spec.']);
        return;
    }

    unlink($abs);
    respond(200, ['ok' => true]);
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

function handleAiFix(): void
{
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $code   = trim($body['code'] ?? '');
    $apiKey = getenv('ANTHROPIC_API_KEY') ?: '';

    if ($code === '') {
        respond(400, ['error' => 'Brak kodu do poprawy.']);
        return;
    }
    if ($apiKey === '') {
        respond(503, ['error' => 'Brak klucza API. Dodaj ANTHROPIC_API_KEY w docker-compose.yml i przebuduj kontener.']);
        return;
    }

    $prompt = <<<PROMPT
You are a Playwright TypeScript test expert. Fix the test code below so it runs without errors.

Rules:
1. Fix ambiguous locators — if a selector matches multiple elements, add a parent like locator('#id').getByRole(...) or use .first()
2. Remove duplicate steps that appear twice in a row doing the same thing
3. Add 1-2 meaningful expect() assertions (e.g. check page title, URL, or a visible element)
4. Keep all the original user actions — do not simplify the flow
5. Return ONLY valid TypeScript code. No markdown, no explanation, no code fences.

Code to fix:
$code
PROMPT;

    $payload = json_encode([
        'model'      => 'claude-haiku-4-5-20251001',
        'max_tokens' => 2048,
        'messages'   => [['role' => 'user', 'content' => $prompt]],
    ], JSON_UNESCAPED_UNICODE);

    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/json\r\nx-api-key: $apiKey\r\nanthropic-version: 2023-06-01",
        'content' => $payload,
        'timeout' => 30,
        'ignore_errors' => true,
    ]]);

    $raw = @file_get_contents('https://api.anthropic.com/v1/messages', false, $ctx);
    if ($raw === false) {
        respond(502, ['error' => 'Błąd połączenia z API Anthropic.']);
        return;
    }

    $resp  = json_decode($raw, true);
    $fixed = $resp['content'][0]['text'] ?? null;

    if (!$fixed) {
        $apiErr = $resp['error']['message'] ?? 'Nieznany błąd API';
        respond(502, ['error' => "Błąd API: $apiErr"]);
        return;
    }

    // Strip markdown code fences if model added them anyway
    $fixed = preg_replace('/^```(?:typescript|ts)?\s*/m', '', $fixed);
    $fixed = preg_replace('/```\s*$/m', '', $fixed);

    respond(200, ['code' => trim($fixed)]);
}

function handleSaveFile(): void
{
    $body     = json_decode(file_get_contents('php://input'), true) ?? [];
    $relPath  = $body['path']    ?? '';
    $content  = $body['content'] ?? null;
    $testsDir = realpath(__DIR__ . '/../tests');

    if (!$testsDir || $relPath === '' || $content === null) {
        respond(400, ['error' => 'Brak ścieżki lub treści.']);
        return;
    }

    // Build absolute path — must stay inside tests dir and be a spec file
    $candidate = $testsDir . '/' . ltrim($relPath, '/');
    $abs       = realpath($candidate) ?: $candidate;
    if (!str_starts_with(realpath(dirname($abs)) . '/', $testsDir . '/')) {
        respond(403, ['error' => 'Niedozwolona ścieżka.']);
        return;
    }
    if (!str_contains(basename($abs), '.spec.')) {
        respond(403, ['error' => 'Można edytować tylko pliki .spec.']);
        return;
    }

    file_put_contents($abs, $content);
    respond(200, ['ok' => true]);
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
