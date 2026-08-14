export type AgoraRole = "admin" | "operator" | "auditor";

export type AgoraActor = {
  id: string;
  email: string;
  role: AgoraRole;
  bitcartAccessToken: string;
};
