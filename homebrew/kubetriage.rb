class Kubetriage < Formula
  desc "KubeTriage - Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  license "MIT"
  version "1.2.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-#{version}-darwin-arm64.tar.gz"
      sha256 "48a10631b8e966a15f74584f8f81893941347befb4bf2cc8e2b3f91d11569f44"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-#{version}-darwin-amd64.tar.gz"
      sha256 "72619ea52943128b8ba72ce5e13f8474b471853ebbeafc2087b42df82242ed47"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-#{version}-linux-amd64.tar.gz"
      sha256 "c87dfeb39c5a08a1c00187affc66fbe50a786ae37021f3dcf7da1a3b8d904c47"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-#{version}-linux-arm64.tar.gz"
      sha256 "3949aace6962b1f5a8bb6410d8bd27b23b96992afccf8dd76c23c27bcc02539e"
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
