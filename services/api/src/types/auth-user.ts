export type AuthPayload = {
  id: string;
  email: string;
  kind: "client" | "business";
  role?: string | null;
};
