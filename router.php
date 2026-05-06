<?php
// PHP built-in server router
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (str_starts_with($uri, '/api')) {
    require __DIR__ . '/api/index.php';
    return true;
}

// Serve static files from dist/
$file = __DIR__ . '/dist' . $uri;
if (file_exists($file) && is_file($file)) {
    return false;
}

// SPA fallback
$index = __DIR__ . '/dist/index.html';
if (file_exists($index)) {
    readfile($index);
    return true;
}

http_response_code(404);
echo 'Run "npm run build" first to generate the dist/ folder.';
