package server

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
)

// PushFiles returns an http.Handler that will, when handling a request at the top-level
// path ('/'), perform an HTTP/2 server push for all filepaths matching any of the given regular
// expressions, and then call the given nextHandler.
//
// Files are searched for recursively in the current working directory.
//
// PushFiles will panic immediately if any of the given regular expressions cannot be compiled.
func PushFiles(patterns []string, nextHandler http.Handler) http.Handler {
	// Compile regular expressions
	regexps := make([]*regexp.Regexp, len(patterns))
	for i, pattern := range patterns {
		regexps[i] = regexp.MustCompile(pattern)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		defer nextHandler.ServeHTTP(w, r)

		if r.URL.Path != "/" {
			// Don't push files for sub-paths, as requests for sub-paths may themselves be the result of previously
			// initiated pushes, so triggering more pushes would cause infinite recursion.
			return
		}

		pusher, isPusher := w.(http.Pusher)
		if !isPusher {
			// HTTP/2 server push not supported for this response writer
			return
		}

		// Walk through all files/subdirectories in the working directory to find matching files
		err := filepath.Walk("./", func(path string, info os.FileInfo, err error) error {
			if err != nil {
				log.Printf("Failed to walk to filepath '%s' when pushing files for '%s': %s", path, r.RemoteAddr, err)
				return err
			}
			if info.IsDir() {
				return nil
			}
			for _, re := range regexps {
				if re.MatchString(path) {
					err = pusher.Push("/"+path, nil)
					if err != nil {
						log.Printf("Failed to perform HTTP/2 server push to '%s' for path '%s': %s", r.RemoteAddr, path, err)
					}
					return nil
				}
			}
			return nil
		})
		if err != nil {
			log.Printf("Failed to walk filepaths when pushing files for '%s': %s", r.RemoteAddr, err)
		}
	})
}
