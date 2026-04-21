class Kubetriage < Formula
  desc "KubeTriage - Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  license "MIT"
  version "1.1.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-darwin-arm64.tar.gz"
      sha256 "0267dd2ed272013876425680433fa66b0e8da06d72189cbbeaa0302f2027f3e2"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-darwin-amd64.tar.gz"
      sha256 "c8d1c11915249a4d227ce9d65fb3cbf991522ac8f78fc02b089555f839140b55"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-linux-amd64.tar.gz"
      sha256 "f6623a36fbf4ff408a1b82b83009e8be14b96b9941671736c5571b9d6d1702bb"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-linux-arm64.tar.gz"
      sha256 "778b864a523484f8e18fc1f2cbf4a3446028bca7723583fcf3f85bd628818aca"
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
