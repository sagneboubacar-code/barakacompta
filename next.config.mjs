/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @react-pdf/renderer charge ses métriques de polices par des chemins
    // résolus à l'exécution. Bundlé par webpack dans la fonction serveur, il
    // fonctionne en local mais casse une fois déployé : on le laisse dans
    // node_modules, tracé par Next, plutôt que bundlé.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
