class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.8.8"
  license "AGPL-3.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.8/kubetriage-v1.8.8-darwin-arm64.tar.gz"
      sha256 "e8337b7265dade6fd3bfda78fd91d7d775dfa3dbe6e1f050c6166357f93352b4"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.8/kubetriage-v1.8.8-darwin-amd64.tar.gz"
      sha256 "505b5c221c69bc6f462e1547cadffe100674a0b13c2b3896a9cf5cc41b863b94"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.8/kubetriage-v1.8.8-linux-amd64.tar.gz"
      sha256 "8053d6de207482df1da9b1fb91ac22a7b5f94ee3b89be8a33068e9025ab3407f"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.8/kubetriage-v1.8.8-linux-arm64.tar.gz"
      sha256 "c9f18daba7ded387de3e4a2558ad8c5f109ff290019663acc32f7162c95fa4e6"
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
