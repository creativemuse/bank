import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@crossmint/client-sdk-react-ui";
import { Modal } from "../common/Modal";
import { Details } from "../common/Details";
import { CopyWrapper } from "../common/CopyWrapper";
import { shortenAddress } from "@/utils/shortenAddress";

export function WalletDetails({ onClose, open }: { onClose: () => void; open: boolean }) {
  const { wallet } = useWallet();
  const { user } = useAuth();
  return (
    <Modal title="Wallet Details" open={open} onClose={onClose} showCloseButton>
      <Details
        values={[
          {
            label: "Address",
            value: (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{shortenAddress(wallet?.address || "")}</span>
                <CopyWrapper toCopy={wallet?.address} iconOnly />
              </div>
            ),
          },
          {
            label: "Chain",
            value: <span className="capitalize">{wallet?.chain || ""}</span>,
          },
          {
            label: "Owner",
            value: user?.email || "",
          },
        ]}
      />
    </Modal>
  );
}
