<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = preg_replace('#^/api#', '', $uri);
$method = $_SERVER['REQUEST_METHOD'];

match (true) {
    $path === '/tests' && $method === 'GET' => handleListTests(),
    $path === '/run'   && $method === 'POST' => handleRun(),
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

    $files = [];
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
    $testsDir    = $projectRoot . '/tests/';

    $fileParts = [];
    foreach ($selectedFiles as $f) {
        $abs = realpath($testsDir . ltrim($f, '/'));
        if ($abs && str_starts_with($abs, realpath($testsDir))) {
            $fileParts[] = escapeshellarg($abs);
        }
    }

    if (empty($fileParts)) {
        respond(400, ['error' => 'Nie znaleziono wybranych plików testów.']);
        return;
    }

    // Write JSON report to temp file to keep stdout clean
    $tmpJson = tempnam(sys_get_temp_dir(), 'pw_');
    $fileArg = implode(' ', $fileParts);
    $cmd     = sprintf(
        'cd %s && npx playwright test %s --reporter=json > %s 2>&1',
        escapeshellarg($projectRoot),
        $fileArg,
        escapeshellarg($tmpJson)
    );

    $start    = microtime(true);
    exec($cmd, $ignored, $exitCode);
    $duration = (int) round((microtime(true) - $start) * 1000);

    $raw     = file_get_contents($tmpJson);
    unlink($tmpJson);

    $results = json_decode($raw, true);

    if ($results === null) {
        // Playwright might print warnings before JSON; find the JSON object
        $start = strpos($raw, '{');
        $results = $start !== false ? json_decode(substr($raw, $start), true) : null;
    }

    respond(200, [
        'success'   => $exitCode === 0,
        'duration'  => $duration,
        'exitCode'  => $exitCode,
        'results'   => $results,
        'rawOutput' => $raw,
    ]);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
