class Kubetriage < Formula
  desc "KubeTriage - Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  license "MIT"
  version "1.5.1"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-darwin-arm64.tar.gz"
      sha256 "7c6da00302b2c383f66b6d724a6efc0d4ff398f7119c473e1740c7a91e1d1b1f"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-darwin-amd64.tar.gz"
      sha256 "c38eedc048a7a7da139dff83df292219e7745cad7bf982075191d40ae083f60b"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-linux-amd64.tar.gz"
      sha256 "de200b69fc824306420dbc2de2b5b0591e05c888448d77d0a689fe0346a6d418"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-linux-arm64.tar.gz"
      sha256 "f1236160a4951edc11940aef382e9bfa7eda496e964b16ef857866e5bb791a4a"
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
