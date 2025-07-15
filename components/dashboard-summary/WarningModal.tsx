import { Modal } from "../common/Modal";

export function WarningModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} showCloseButton title="Withdraw is not configured">
      <div className="mt-4 space-y-3 text-sm text-gray-500">
        <p>
          To enable withdrawals, you need to configure Coinbase API keys in your environment
          variables.
        </p>
        <div className="text-left">
          <p className="font-semibold">Required environment variables:</p>
          <ul className="ml-4 mt-2 list-disc space-y-1">
            <li>
              <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">COINBASE_API_KEY_ID</code>
            </li>
            <li>
              <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
                COINBASE_API_KEY_SECRET
              </code>
            </li>
          </ul>
        </div>
        <p className="text-xs">
          Get these keys from your{" "}
          <a
            href="https://portal.cdp.coinbase.com/products/onramp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Coinbase Developer Portal
          </a>
        </p>
      </div>
    </Modal>
  );
}
