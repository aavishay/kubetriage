import React, { memo } from 'react';
import { Link as RouterLink, LinkProps as RouterLinkProps } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

interface LinkProps extends RouterLinkProps {
  /** Whether the link opens in a new tab */
  isExternal?: boolean;
  /** Whether to show the external link icon */
  showExternalIcon?: boolean;
}

/**
 * Accessible Link component
 * - Handles internal routing with React Router
 * - Adds proper attributes for external links (target, rel)
 * - Shows external link icon for external links
 *
 * @example
 * // Internal link
 * <Link to="/dashboard">Dashboard</Link>
 *
 * // External link
 * <Link to="https://example.com" isExternal>External Site</Link>
 */
const LinkComponent: React.FC<LinkProps> = ({
  isExternal = false,
  showExternalIcon = true,
  children,
  ...props
}) => {
  if (isExternal) {
    return (
      <RouterLink
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors ${props.className || ''}`}
      >
        {children}
        {showExternalIcon && <ExternalLink className="w-3 h-3" aria-hidden="true" />}
        <span className="sr-only">(opens in new tab)</span>
      </RouterLink>
    );
  }

  return <RouterLink {...props} >{children}</RouterLink>;
};

export const Link = memo(LinkComponent);
