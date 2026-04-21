class Kubetriage < Formula
  desc "KubeTriage - Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  license "MIT"
  version "0.0.1"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-darwin-arm64.tar.gz"
      sha256 "b9c3b00bb62a9105d5398da6b5bd5625cda75a080c5a3012c4677bf095731e12"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-darwin-amd64.tar.gz"
      sha256 "a1247558a6c43c22a7a7a4c4cc7d205d658046be4ea91f2763e763bda07a5ae5"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-linux-amd64.tar.gz"
      sha256 "04892aa86984b70e044c35442aadcf5b7c988f34dfa6b765fb1efffc96eab806"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-linux-arm64.tar.gz"
      sha256 "802f5141994ef96a67e4cc92230b0e6fc536e18fa1d080ccf5d5c72426722cf1"
    end
  end

  def install
    bin.install "kubetriage-#{OS.kernel_name.downcase}-#{Hardware::CPU.arch.to_s.gsub(/x86_64/, "amd64")}" => "kubetriage"
  end

  def post_install
    puts "KubeTriage installed!"
    puts "Run 'kubetriage serve' to start the server."
    puts "Run 'kubetriage --help' for all available commands."
  end

  test do
    system "#{bin}/kubetriage", "--help"
  end
end
