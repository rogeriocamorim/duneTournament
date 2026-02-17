import { motion, AnimatePresence } from "motion/react";
import { useState, useCallback } from "react";
import { X, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
}

export function ShareModal({ isOpen, onClose, shareUrl }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error("Fallback copy failed:", fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  }, [shareUrl]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="glass-morphism-strong rounded-sm p-8 max-w-2xl w-full relative">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-sand-dark hover:text-spice transition-colors"
              >
                <X size={20} />
              </button>

              {/* Header */}
              <h2 className="text-display text-xl mb-1 text-spice spice-text-glow">
                Share Tournament Standings
              </h2>
              <p className="text-sm text-sand-dark mb-6 uppercase tracking-wider">
                One Link for the Entire Tournament
              </p>

              {/* QR Code */}
              <div className="flex justify-center mb-6">
                <div className="bg-white p-6 rounded-sm">
                  <QRCodeSVG
                    value={shareUrl}
                    size={512}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>

              {/* URL Display */}
              <div className="mb-4">
                <label className="text-xs text-sand-dark uppercase tracking-widest mb-2 block">
                  Shareable Link:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-4 py-2 bg-obsidian/50 border border-sand-dark/30 rounded-sm text-sand text-sm font-mono"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`px-4 py-2 rounded-sm transition-colors flex items-center gap-2 ${
                      copied
                        ? "bg-fremen-blue text-white"
                        : "bg-spice hover:bg-spice/80 text-obsidian"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={16} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="glass-morphism rounded-sm p-4 text-sm text-sand-dark space-y-2">
                <p className="flex items-start gap-2">
                  <span className="text-spice">✨</span>
                  <span>
                    <strong className="text-spice">This link will ALWAYS show the latest standings.</strong>{" "}
                    No need to share new links after each round!
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-fremen-blue">📱</span>
                  <span>
                    Players can scan the QR code with their phone camera or visit the link in any browser.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-sand">🔄</span>
                  <span>
                    After completing each round, click <strong>Share</strong> again to update the standings.
                    The same link and QR code will automatically show the new data.
                  </span>
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
