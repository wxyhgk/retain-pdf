import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { Eye, EyeOff } from "lucide-react";

type SecretInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  secretLabel: string;
};

export const SecretInput = forwardRef<HTMLInputElement, SecretInputProps>(
  function SecretInput({ secretLabel, className = "", disabled, ...inputProps }, ref) {
    const [revealed, setRevealed] = useState(false);
    const actionVerb = revealed ? "隐藏" : "显示";
    const actionLabel = /^[A-Za-z]/.test(secretLabel)
      ? `${actionVerb} ${secretLabel}`
      : `${actionVerb}${secretLabel}`;

    return (
      <span className="credential-secret-field">
        <input
          {...inputProps}
          ref={ref}
          className={className}
          type={revealed ? "text" : "password"}
          disabled={disabled}
        />
        <button
          type="button"
          className={`credential-secret-toggle${revealed ? " is-revealed" : ""}`}
          aria-label={actionLabel}
          aria-pressed={revealed}
          title={actionLabel}
          disabled={disabled}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </span>
    );
  },
);
