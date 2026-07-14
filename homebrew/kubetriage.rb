class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.8.5"
  license "AGPL-3.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.5/kubetriage-v1.8.5-darwin-arm64.tar.gz"
      sha256 "72e532742ad7553bcd9470fb3b9723d78733ac90310b23899a8ed3db47055d91"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.5/kubetriage-v1.8.5-darwin-amd64.tar.gz"
      sha256 "72a7fa7082355f8490aace426ee43089516075041f60d8eea84e557810ee1741"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.5/kubetriage-v1.8.5-linux-amd64.tar.gz"
      sha256 "4c51f68f6a04c70b7e4e8c54d20e59ba2c71d5aaed5c61b5eb0fb5ede488df8f"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.5/kubetriage-v1.8.5-linux-arm64.tar.gz"
      sha256 "f79398f0a80dae0e3faa023dd1a2bd3fdf7c8d3dbdea99a5415765e59f0f6914"
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
