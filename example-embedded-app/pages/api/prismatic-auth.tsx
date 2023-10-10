import config from "../../prismatic/config";
import jsonwebtoken from "jsonwebtoken";

/**
 * This is a simple API route that generates a JWT token for the user.
 * In a production environment, please ensure that this route is protected
 * and lives in your backend API (i.e. do not expose your signing key to the client).
 */

export default function handler(_req, res) {
  const currentTime = Math.floor(Date.now() / 1000);
  const token = jsonwebtoken.sign(
    {
      sub: config.sub, // Some unique identifier for the user
      external_id: config.external_id,
      name: config.name,
      organization: config.organization,
      customer: config.customer,
      nbf: currentTime,
      iat: currentTime,
      exp: currentTime + 60 * 60 * 4, // 4 hours from now
      role: config.role,
    },
    config.signingKey, // Store this somewhere safe
    { algorithm: "RS256" },
  );
  res.status(200).json({ token });
}
