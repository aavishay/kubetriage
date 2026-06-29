package main

import (
	"os"
	"strings"

	"github.com/aavishay/kubetriage/backend/cmd/cli"
)

func main() {
	// Default to the "serve" command for backwards compatibility when no
	// subcommand is provided. If a subcommand is given (e.g. "gitops"),
	// execute it directly.
	if len(os.Args) < 2 || strings.HasPrefix(os.Args[1], "-") {
		os.Args = append([]string{"kubetriage", "serve"}, os.Args[1:]...)
	}
	cli.Execute()
}
