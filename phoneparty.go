package main

import (
	"crypto/tls"
	"flag"
	"github.com/shone/phoneparty/server"
	"golang.org/x/crypto/acme/autocert"
	"log"
	"net/http"
)

var (
	listen    = flag.String("listen", ":http", "The host/port to listen on, e.g. localhost:8080")
	domain    = flag.String("domain", "", "e.g. 'example.com' When given, serves HTTPS for the domain using Let's Encrypt.")
	multihost = flag.Bool("multihost", false, "Allow multiple hosts (one per IPv4 address).")
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

	var (
		hostAssets   = []string{"host/.*.(mjs|css|woff2)", "^common/.*.(mjs|css)"}
		playerAssets = []string{"player/.*.(mjs|css|woff2)", "^common/.*.(mjs|css)"}
	)

	http.Handle("/host/", http.StripPrefix("/host", server.PushFiles(hostAssets, server.NoCache(http.FileServer(http.Dir("./host"))))))
	http.Handle("/player/", http.StripPrefix("/player", server.PushFiles(playerAssets, server.NoCache(http.FileServer(http.Dir("./player"))))))

	http.Handle("/common/", server.AllowRootServiceWorker(http.StripPrefix("/common/", server.NoCache(http.FileServer(http.Dir("./common"))))))
	http.Handle("/sounds/", http.StripPrefix("/sounds/", server.NoCache(http.FileServer(http.Dir("./sounds")))))
	http.Handle("/fonts/", http.StripPrefix("/fonts/", server.NoCache(http.FileServer(http.Dir("./fonts")))))
	http.Handle("/apps/", http.StripPrefix("/apps/", server.NoCache(http.FileServer(http.Dir("./apps")))))
	http.Handle("/sandbox/", http.StripPrefix("/sandbox/", server.NoCache(http.FileServer(http.Dir("./sandbox")))))

	http.Handle("/host/ws", server.HandleHostWebsocket(*multihost))
	http.Handle("/player/ws", server.HandlePlayerWebsocket(*multihost))

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
		log.Println("Starting HTTP server on", *listen)
		err := http.ListenAndServe(*listen, nil)
		log.Fatal(err)
	}
}
