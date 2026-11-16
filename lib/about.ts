export const aboutPortrait = {
  src: "/referencia/thalia-retrato-faceless.webp",
  alt: "Retrato faceless da Thalia de vestido azul-petróleo segurando uma mandala verde",
  width: 896,
  height: 1120,
};

const defaultAboutText = [
  "Oi, eu sou a Thalia, a artista por trás da ArtisTha. Sempre gostei de guardar momentos, ideias e pequenos detalhes que me tocam. Encontrei na pintura um jeito de dar forma à minha fé, às minhas memórias e às histórias que outras pessoas me contam.",
  "Nos retratos faceless, o cabelo, os gestos e as cores ajudam a reconhecer quem está ali. Nas mandalas, o desenho aparece ponto por ponto. Pinto cada peça à mão e gosto de mostrar o processo, das primeiras misturas de tinta aos detalhes que só aparecem quando a gente chega mais perto.",
  "Algumas pinturas saem daqui e ganham um cantinho novo. Gosto de pensar que uma delas pode te lembrar de alguém ou de um momento que você quer guardar. Se você também gosta de arte feita à mão, fica por aqui.",
].join("\n\n");

const legacyAboutText = "Uma vitrine de artesanato brasileiro, com peças em cerâmica, macramê e crochê.\n\nEntre fios, barro e madeira, cada peça ganha forma à mão. As encomendas podem incluir escolhas de tamanho, cor e acabamento, conforme o produto.";

export function storeAboutText(saved: string | undefined) {
  if (saved == null) return defaultAboutText;
  const normalized = saved.replaceAll("\\n", "\n").trim();
  return !normalized || normalized === legacyAboutText ? defaultAboutText : normalized;
}
