/** @type {import('next').NextConfig} */

// Fichiers de métriques des 14 polices PDF standard. pdfkit les charge par un
// chemin construit à l'exécution (`./standard-fonts/${nom}.cjs`), que l'analyse
// statique de Next ne voit pas : sans cette inclusion explicite, le rendu
// marche en local et échoue une fois déployé avec
// « Cannot find module '/var/task/node_modules/pdfkit/js/standard-fonts/Helvetica.cjs' ».
const PDF_FONT_FILES = ["./node_modules/pdfkit/js/standard-fonts/**"];

const nextConfig = {
  experimental: {
    // Laisser @react-pdf/renderer dans node_modules plutôt que le faire bundler
    // par webpack : ses résolutions de chemins internes ne survivent pas au
    // bundling de la fonction serveur.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
    // Les deux clés couvrent les deux formes d'identifiant de route selon la
    // version de Next — l'une ou l'autre s'applique, jamais rien de superflu.
    // Toute nouvelle route qui produit un PDF doit être ajoutée ici.
    outputFileTracingIncludes: {
      "/api/reports/financial/pdf": PDF_FONT_FILES,
      "/api/reports/financial/pdf/route": PDF_FONT_FILES,
      "/api/payments/[id]/receipt/pdf": PDF_FONT_FILES,
      "/api/payments/[id]/receipt/pdf/route": PDF_FONT_FILES,
      "/api/payments/family/[id]/pdf": PDF_FONT_FILES,
      "/api/payments/family/[id]/pdf/route": PDF_FONT_FILES,
      "/api/reports/collections/pdf": PDF_FONT_FILES,
      "/api/reports/collections/pdf/route": PDF_FONT_FILES,
    },
  },
};

export default nextConfig;
