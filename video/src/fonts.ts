import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";
import { loadFont as loadQuicksand } from "@remotion/google-fonts/Quicksand";

const { fontFamily: nunitoFamily } = loadNunito("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const { fontFamily: quicksandFamily } = loadQuicksand("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export { nunitoFamily, quicksandFamily };
