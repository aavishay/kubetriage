package ui

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed dist/*
var distFS embed.FS

func GetStaticFS() http.FileSystem {
	// Root the filesystem at "dist" (contains index.html, favicon.ico, assets/)
	f, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}
	return http.FS(f)
}

func GetAssetsFS() http.FileSystem {
	// Root the filesystem at "dist/assets" for the /assets route
	f, err := fs.Sub(distFS, "dist/assets")
	if err != nil {
		panic(err)
	}
	return http.FS(f)
}

func GetIndexHTML() ([]byte, error) {
	return distFS.ReadFile("dist/index.html")
}
