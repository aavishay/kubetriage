class Kubetriage < Formula
  desc "KubeTriage - Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  license "MIT"
  version "1.7.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.0/kubetriage-v1.7.0-dirty-darwin-arm64.tar.gz"
      sha256 "2e906f02ab0620cc53735447720cb0de10b36a51c760ba45fb7f51a73ded2002"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.0/kubetriage-v1.7.0-dirty-darwin-amd64.tar.gz"
      sha256 "162b740a42eca690eb90f8a6299bb49abf14c1caad7b5d6384ac25e03771e2ad"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.0/kubetriage-v1.7.0-dirty-linux-amd64.tar.gz"
      sha256 "c6253892f9b164a8e458a06600a3d19544d4146bc2c15d75a77bbe26368f5697"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.0/kubetriage-v1.7.0-dirty-linux-arm64.tar.gz"
      sha256 "333d918b785581699f05f889616463bccebd535589ee52464a4cccff90c8b562"
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
