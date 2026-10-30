import { supabase, formatarPreco } from "../lib/supabase";

export const revalidate = 60;

export default async function Home() {
  const { data: produtos, error } = await supabase
    .from("produtos")
    .select("id, nome, preco_centavos, fotos")
    .order("created_at", { ascending: false });

  return (
    <>
      <header className="topo">
        <span className="marca">ArtisTha</span>
        <p>Feito à mão</p>
      </header>
      <main className="vitrine">
        <h1>Peças únicas, feitas à mão</h1>
        {error && <p className="vazio">Não foi possível carregar os produtos. Tente de novo em instantes.</p>}
        {!error && produtos.length === 0 && (
          <p className="vazio">Nenhum produto cadastrado ainda. Cadastre o primeiro no painel do Supabase.</p>
        )}
        <div className="grade">
          {(produtos ?? []).map((p) => (
            <article className="peca" key={p.id}>
              {p.fotos?.[0] ? <img src={p.fotos[0]} alt={p.nome} /> : <div className="sem-foto" />}
              <h2>{p.nome}</h2>
              <p className="preco">{formatarPreco(p.preco_centavos)}</p>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
