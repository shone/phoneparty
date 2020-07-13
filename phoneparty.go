package main

import (
	"crypto/tls"
	"flag"
	"github.com/joshua-shone/phone-party/server"
	"golang.org/x/crypto/acme/autocert"
	"log"
	"net/http"
)

var (
	serve_address = flag.String("serve_address", ":8080", "The host/port to serve on, e.g. localhost:8080")
	domain        = flag.String("domain", "", "e.g. 'example.com' When specified, will serve HTTPS for the domain using automatically retrieved Let's Encrypt certificates.")
)

func main() {
	flag.Parse()

	http.HandleFunc("/", func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/" {
			http.Redirect(response, request, "/player/", http.StatusSeeOther)
		} else {
			http.NotFoundHandler().ServeHTTP(response, request)
		}
	})

	hostAssets := []string{"host/.*.(mjs|css|woff2)", "^shared/.*.mjs"}
	playerAssets := []string{"player/.*.(mjs|css|woff2)", "^shared/.*.mjs"}

	http.Handle("/player/", http.StripPrefix("/player/", server.PushFiles(playerAssets, http.FileServer(http.Dir("./player")))))
	http.Handle("/host/", http.StripPrefix("/host", server.PushFiles(hostAssets, http.FileServer(http.Dir("./host")))))

	http.Handle("/shared/", http.StripPrefix("/shared/", http.FileServer(http.Dir("./shared"))))
	http.Handle("/sounds/", http.StripPrefix("/sounds/", http.FileServer(http.Dir("./sounds"))))
	http.Handle("/fonts/", http.StripPrefix("/fonts/", http.FileServer(http.Dir("./fonts"))))
	http.Handle("/games/", http.StripPrefix("/games/", http.FileServer(http.Dir("./games"))))
	http.Handle("/sandbox/", http.StripPrefix("/sandbox/", http.FileServer(http.Dir("./sandbox"))))

	http.HandleFunc("/host/ws", server.HandleHostWebsocket)
	http.HandleFunc("/player/ws", server.HandlePlayerWebsocket)

	if *domain != "" {

		certManager := autocert.Manager{
			Prompt:     autocert.AcceptTOS,
			HostPolicy: autocert.HostWhitelist(*domain),
			Cache:      autocert.DirCache("certs"),
		}

		log.Println("Serving HTTP on", *domain, "for ACME and HTTPS redirect")
		go func() {
			err := http.ListenAndServe(":http", certManager.HTTPHandler(nil))
			log.Fatal(err)
		}()

		server := &http.Server{
			Addr: ":https",
			TLSConfig: &tls.Config{
				GetCertificate: certManager.GetCertificate,
			},
		}

		log.Println("Serving HTTPS on", *domain)
		err := server.ListenAndServeTLS("", "")
		log.Fatal(err)
	} else {
		log.Println("Starting HTTP server on", *serve_address)
		err := http.ListenAndServe(*serve_address, nil)
		log.Fatal(err)
	}
}
