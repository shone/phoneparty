package server

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func FileServer(directory http.Dir, prefix string) http.Handler {
	handler := http.StripPrefix(prefix, http.FileServer(directory))

	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {

		writer.Header().Set("Cache-Control", "must-revalidate")

		switch request.URL.Path {
		case "/", "/host":
			// Rather than needing a build step to bundle JS/CSS into a single file, rely on
			// HTTP2 server push to transfer all required files immediately.
			if pusher, ok := writer.(http.Pusher); ok {
				switch request.URL.Path {
				case "/":
					pushFilesForPlayer(pusher)
				case "/host/":
					pushFilesForHost(pusher)
				}
			}
		}

		handler.ServeHTTP(writer, request)
	})
}

func PushFiles(pattern string, handler http.Handler) http.Handler {
	return http.HandlerFunc(func (w http.ResponseWriter, r *http.Request) {
		if pusher, ok := writer.(http.Pusher); ok {
			matches, err := filepath.Glob(pattern)
			if err != nil {
				http.Error(w, )
			}
	}
}

func pushFilesForPlayer(pusher http.Pusher) {
	pushFiles(pusher, "player", "/", "")
	pushFiles(pusher, "shared", "/shared/", "")
	pushFiles(pusher, "games", "/games/", "player")
}

func pushFilesForHost(pusher http.Pusher) {
	pushFiles(pusher, "host", "/host/", "")
	pushFiles(pusher, "shared", "/shared/", "")
	pushFiles(pusher, "games", "/games/", "host")
}

func pushFiles(pusher http.Pusher, directory, prefix, matchSubdir string) {
	err := filepath.Walk(directory, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			log.Println(err)
			return err
		}

		if info.IsDir() {
			if matchSubdir != "" {
				parts := strings.Split(path, "/")
				if len(parts) >= 3 {
					for _, part := range parts {
						if part == matchSubdir {
							return nil
						}
					}
					return filepath.SkipDir
				}
			} else {
				return nil
			}
		}

		ext := filepath.Ext(info.Name())

		switch ext {
		case ".mjs", ".css":
			url := prefix + path[len(directory)+1:]
			err := pusher.Push(url, nil)
			if err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		log.Println(err)
	}
}
