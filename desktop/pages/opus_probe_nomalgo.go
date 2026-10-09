//go:build nomalgo

package pages

// Форсируем компиляцию opus без malgo.
// Если приложение стартует с этим файлом → малo виновник только malgo.
// Если всё равно падает → проблема в CGO-линковке opus или mingw в целом.

import _ "github.com/hraban/opus"
