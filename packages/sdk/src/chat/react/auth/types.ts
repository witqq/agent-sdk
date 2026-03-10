import type { ReactNode } from "react";
import type { UseRemoteAuthReturn } from "../useRemoteAuth.js";

/**
 * Props passed to per-backend auth form components.
 * Each backend implements its own form using these props.
 */
export interface AuthFormProps {
  /** The remote auth hook instance, pre-configured for this backend. */
  auth: UseRemoteAuthReturn;
  /** Called when authentication completes successfully. */
  onAuthComplete: () => void;
}

/** A backend auth form component. */
export type AuthFormComponent = (props: AuthFormProps) => ReactNode;
