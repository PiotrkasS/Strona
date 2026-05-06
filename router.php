<?php
// PHP built-in server router
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (str_starts_with($uri, '/api')) {
    require __DIR__ . '/api/index.php';
    return true;
}

// Static files from dist/ (JS, CSS, assets…)
$file = __DIR__ . '/dist' . $uri;
if (file_exists($file) && is_file($file)) {
    $ext  = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mime = [
        'js'    => 'application/javascript; charset=utf-8',
        'css'   => 'text/css; charset=utf-8',
        'html'  => 'text/html; charset=utf-8',
        'json'  => 'application/json',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'svg'   => 'image/svg+xml',
        'ico'   => 'image/x-icon',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf',
        'map'   => 'application/json',
    ][$ext] ?? 'application/octet-stream';
    header("Content-Type: $mime");
    readfile($file);
    return true;
}

// SPA fallback — serve index.html for all React routes
$index = __DIR__ . '/dist/index.html';
if (file_exists($index)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($index);
    return true;
}

http_response_code(404);
echo 'Run "npm run build" first to generate the dist/ folder.';
