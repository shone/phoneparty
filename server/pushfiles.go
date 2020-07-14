package server

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
)

// PushFiles returns an http.Handler that will, when handling a request at the top-level
// path ('/'), perform an HTTP/2 server push for all filepaths matching the given regular
// expressions, and then call the given nextHandler.
func PushFiles(patterns []string, nextHandler http.Handler) http.Handler {
	// Compile regular expressions
	regexps := make([]*regexp.Regexp, len(patterns))
	for i, pattern := range patterns {
		regexps[i] = regexp.MustCompile(pattern)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		defer nextHandler.ServeHTTP(w, r)

		if r.URL.Path != "/" {
			return
		}

		pusher, isPusher := w.(http.Pusher)
		if !isPusher {
			// HTTP/2 server push not supported for this response writer
			return
		}

		err := filepath.Walk("./", func(path string, info os.FileInfo, err error) error {
			if err != nil {
				log.Println(err)
				return err
			}
			if info.IsDir() {
				return nil
			}
			for _, re := range regexps {
				if re.MatchString(path) {
					pusher.Push("/"+path, nil)
					return nil
				}
			}
			return nil
		})
		if err != nil {
			log.Println(err)
		}
	})
}
