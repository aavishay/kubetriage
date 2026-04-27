class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.7.2"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.2/kubetriage-v1.7.2-darwin-arm64.tar.gz"
      sha256 "b8763302d4465c4337fa0f3cf8b0f6e5462cca12918dcf193621d2fb0463bb0c"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.2/kubetriage-v1.7.2-darwin-amd64.tar.gz"
      sha256 "d8d4f586e51162af7026cf3408904e5071d5b91b2eacfcfe25830480ec7d3528"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.2/kubetriage-v1.7.2-linux-amd64.tar.gz"
      sha256 "c1efd07738608b5cd8fd137254b95311788c60fef5bedf9f3ff2fc5c7aa0a2fb"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.2/kubetriage-v1.7.2-linux-arm64.tar.gz"
      sha256 "ce9da88cd7b7f8e21e9cc4dff375fe73c4ee6b72d3b98e4973ef4a0c7c60fe23"
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
