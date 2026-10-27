import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      leadingIcon,
      trailingIcon,
      loading = false,
      disabled,
      className = '',
      type = 'button',
      children,
      ...rest
    },
    ref
  ) => {
    const isDisabled = Boolean(disabled || loading);
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`ap-btn ap-btn--${variant} ap-btn--${size} ${className}`.trim()}
        {...rest}
      >
        {loading ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
            style={{ animation: 'spin 0.9s linear infinite' }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          leadingIcon
        )}
        {children !== undefined && children !== null && <span>{children}</span>}
        {trailingIcon}
      </button>
    );
  }
);
Button.displayName = 'Button';

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required accessible label for screen readers */
  'aria-label': string;
  variant?: Exclude<ButtonVariant, 'primary'> | 'primary';
  size?: ButtonSize;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      className = '',
      type = 'button',
      title,
      children,
      ...rest
    },
    ref
  ) => {
    const ariaLabel = rest['aria-label'];
    return (
      <button
        ref={ref}
        type={type}
        title={title ?? ariaLabel}
        className={`ap-btn ap-icon-btn ap-btn--${variant} ap-btn--${size} ${className}`.trim()}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';
