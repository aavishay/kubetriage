package cli

import (
	"os"

	"github.com/spf13/cobra"
)

// completionCmd represents the completion command
var completionCmd = &cobra.Command{
	Use:   "completion [bash|zsh|fish|powershell]",
	Short: "Generate shell completion script",
	Long: `Generate shell completion script for KubeTriage.

To load completions:

Bash:
  $ source <(kubetriage completion bash)
  # To load completions for each session, execute once:
  # Linux:
  $ kubetriage completion bash > /etc/bash_completion.d/kubetriage
  # macOS:
  $ kubetriage completion bash > /usr/local/etc/bash_completion.d/kubetriage

Zsh:
  $ source <(kubetriage completion zsh)
  # To load completions for each session, execute once:
  $ kubetriage completion zsh > "${fpath[1]}/_kubetriage"

Fish:
  $ kubetriage completion fish | source
  # To load completions for each session, execute once:
  $ kubetriage completion fish > ~/.config/fish/completions/kubetriage.fish

PowerShell:
  PS> kubetriage completion powershell | Out-String | Invoke-Expression
  # To load completions for every new session, run:
  PS> kubetriage completion powershell > kubetriage.ps1
  # and source this file from your PowerShell profile.
`,
	DisableFlagsInUseLine: true,
	ValidArgs:             []string{"bash", "zsh", "fish", "powershell"},
	Args:                  cobra.ExactValidArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		switch args[0] {
		case "bash":
			cmd.Root().GenBashCompletion(os.Stdout)
		case "zsh":
			cmd.Root().GenZshCompletion(os.Stdout)
		case "fish":
			cmd.Root().GenFishCompletion(os.Stdout, true)
		case "powershell":
			cmd.Root().GenPowerShellCompletionWithDesc(os.Stdout)
		}
	},
}

func init() {
	rootCmd.AddCommand(completionCmd)
}
