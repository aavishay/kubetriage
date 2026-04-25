class Kubetriage < Formula
  desc "KubeTriage - Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  license "MIT"
  version "1.6.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.6.0/kubetriage-v1.6.0-1-gfd39d9e-dirty-darwin-arm64.tar.gz"
      sha256 "a7e8e59986f2ef2554230236ada3d63f76adb43626d812ae7f035bb40d9d63f0"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.6.0/kubetriage-v1.6.0-1-gfd39d9e-dirty-darwin-amd64.tar.gz"
      sha256 "ae7bcf743ffa78c7a0f43928f0f03971b9a33ad602f9e74ab4b00abfbaf0bab9"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.6.0/kubetriage-v1.6.0-1-gfd39d9e-dirty-linux-amd64.tar.gz"
      sha256 "0a32216c8ee1993df3494c3fe7a6a22efadd8ad18497f34e97d183cfe9483872"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.6.0/kubetriage-v1.6.0-1-gfd39d9e-dirty-linux-arm64.tar.gz"
      sha256 "2f6e8527734878f9132b2ee49d76d1dccd5eddab3276d7081066bc352f707578"
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
