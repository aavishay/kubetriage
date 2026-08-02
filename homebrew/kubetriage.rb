class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.8.6"
  license "AGPL-3.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.6/kubetriage-v1.8.6-darwin-arm64.tar.gz"
      sha256 "3253404422ebe5a155884cc4cc3392055c0d4d09e1740e6357a2c495268c5fd2"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.6/kubetriage-v1.8.6-darwin-amd64.tar.gz"
      sha256 "215390a1ecb250c3ae8034f48921614479ee25a2145300326a607b668f8fc58f"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.6/kubetriage-v1.8.6-linux-amd64.tar.gz"
      sha256 "53109b1171e546923de2c3b3c99c69c7cfc291dfb89b8122f3dcf115fbe5ecd4"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.6/kubetriage-v1.8.6-linux-arm64.tar.gz"
      sha256 "b2572ad0280003a6a75528f93c80217ab70d24855a1f37757fb5d8e7fc850554"
    end
  end

  def install
    binary_name = "kubetriage-#{OS.kernel_name.downcase}-#{Hardware::CPU.arch}"
    binary_name = binary_name.gsub("x86_64", "amd64")
    bin.install binary_name => "kubetriage"
  end

  def post_install
    puts "KubeTriage installed!"
    puts "Run 'kubetriage serve' to start the server."
    puts "Run 'kubetriage --help' for all available commands."
  end

  test do
    system bin/"kubetriage", "--help"
  end
end
