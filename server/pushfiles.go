package server

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
)

func PushFiles(patterns []string, handler http.Handler) http.Handler {
	regexps := make([]*regexp.Regexp, len(patterns))
	for i, pattern := range patterns {
		regexps[i] = regexp.MustCompile(pattern)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer handler.ServeHTTP(w, r)

		if r.URL.Path != "/" {
			return
		}

		pusher, isPusher := w.(http.Pusher)
		if !isPusher {
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
