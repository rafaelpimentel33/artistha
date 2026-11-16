import { ChevronRight } from "lucide-react";
import { whatsappHref, type StoreConfig } from "../../lib/store-model";

export function PrivacyPage({ config }: { config: StoreConfig }) {
  const controller = config.privacyController || config.name;
  const email = config.privacyEmail || config.contactEmail;
  const contact = email ? `mailto:${email}?subject=Privacidade%20e%20dados%20pessoais`
    : config.whatsapp ? whatsappHref(config.whatsapp, `Olá, gostaria de falar sobre meus dados pessoais na ${config.name}.`)
    : "/contato";

  return <article className="wrap privacy-page">
    <nav className="breadcrumb" aria-label="Caminho da página">
      <a href="/">Início</a><ChevronRight size={13} aria-hidden="true" /><span aria-current="page">Privacidade</span>
    </nav>
    <header>
      <h1>Política de privacidade</h1>
      <p>Veja quais dados o ateliê usa ao receber pedidos e como falar com a loja sobre suas informações.</p>
      <p className="muted">Atualizada em <time dateTime="2026-11-15">15 de novembro de 2026</time></p>
    </header>

    <section>
      <h2>Responsável pelos dados</h2>
      <p><strong>{controller}</strong> é responsável pelos dados tratados na loja {config.name}.</p>
    </section>

    <section>
      <h2>Dados que usamos e por quê</h2>
      <ul>
        <li><strong>Conta e cadastro.</strong> Usamos e-mail confirmado e senha para autenticar as novas contas. Contas antigas também podem entrar com o nome de usuário. O nome do cliente identifica o cadastro, e telefone e CEP podem ser informados para facilitar o atendimento e o preenchimento de pedidos.</li>
        <li><strong>CPF opcional.</strong> Se informado, usamos o CPF para evitar cadastro duplicado. O número é validado e convertido em um código protegido. A loja guarda o código e os dois últimos dígitos para exibir a identificação parcial em Minha conta.</li>
        <li><strong>Pedidos e atendimento.</strong> Guardamos o nome, os itens, os dados de contato do cadastro, a forma de recebimento, o CEP para entrega e as observações que você enviar. Usamos esses dados para preparar a encomenda, combinar a entrega e disponibilizar o histórico.</li>
        <li><strong>Imagens de referência.</strong> Nas peças personalizáveis, você pode anexar uma imagem para a confecção. Envie apenas imagens necessárias ao pedido e que você tenha autorização para compartilhar. As referências ficam em armazenamento privado, acessível à equipe autorizada.</li>
        <li><strong>Funcionamento e segurança.</strong> Os provedores podem registrar dados técnicos, como endereço IP, horário e informações da solicitação, para entregar o site, manter a segurança e diagnosticar falhas.</li>
      </ul>
      <p>Tratamos dados para atender a suas solicitações e executar pedidos, cumprir obrigações legais e, quando aplicável, proteger a operação da loja e exercer direitos.</p>
    </section>

    <section>
      <h2>Cookies e armazenamento no navegador</h2>
      <dl className="privacy-storage">
        <div><dt>Sessão de login</dt><dd>Ao entrar, o Supabase usa cookies de sessão para manter sua conta autenticada. Os cookies podem permanecer no navegador por até 400 dias, conforme a renovação da sessão. Use “Sair” para encerrá-la neste navegador.</dd></div>
        <div><dt>Redefinição de senha</dt><dd>Após validar um link de recuperação, um cookie técnico permite trocar a senha por até 15 minutos.</dd></div>
        <div><dt>Carrinho</dt><dd>O armazenamento local guarda os itens, quantidades, variações e códigos de referência do carrinho para que ele possa ser recuperado ao voltar. Os itens saem do carrinho quando são removidos ou quando o pedido é salvo.</dd></div>
        <div><dt>Tentativa de pedido</dt><dd>Um identificador aleatório e um código calculado a partir do conteúdo do pedido ficam na sessão da aba para evitar duplicidade. A loja remove o registro após salvar o pedido.</dd></div>
      </dl>
      <p>O armazenamento no navegador se limita a essas funções. Você pode apagar os dados deste site nas configurações do seu navegador, o que encerra a sessão e limpa o carrinho salvo neste dispositivo.</p>
    </section>

    <section>
      <h2>Quem recebe os dados</h2>
      <p>A Vercel hospeda o site. O Supabase fornece autenticação, banco de dados e armazenamento de arquivos. Esses serviços podem processar dados fora do Brasil conforme sua infraestrutura. O ateliê pode compartilhar os dados necessários com o serviço responsável pela entrega e atender solicitações legais de autoridades.</p>
      <p>Ao escolher <strong>Abrir WhatsApp</strong>, o resumo do pedido é usado para preencher a conversa no serviço. O envio da mensagem é confirmado por você. O WhatsApp tem política de privacidade própria.</p>
    </section>

    <section>
      <h2>Por quanto tempo guardamos</h2>
      <p>Mantemos os dados enquanto forem necessários para a conta, a confecção, a entrega, o atendimento e o cumprimento de obrigações legais. Podemos conservar registros necessários para exercer direitos. Se você enviou uma referência e desistiu do pedido, pode solicitar a exclusão da imagem pelo canal abaixo.</p>
    </section>

    <section aria-labelledby="privacy-rights">
      <h2 id="privacy-rights">Seus direitos e nosso contato</h2>
      <p>Você pode solicitar confirmação do tratamento, acesso, correção, informação sobre compartilhamento, anonimização, bloqueio, eliminação ou portabilidade, conforme a LGPD. Nos casos aplicáveis, você também pode se opor ao tratamento, revogar o consentimento ou apresentar uma petição à ANPD.</p>
      <p>Para solicitar uma dessas medidas, o encerramento da conta ou a exclusão de uma referência, informe o que precisa pelo canal de privacidade. Podemos pedir uma confirmação de identidade para proteger seus dados.</p>
      <a className="button" href={contact} rel={contact.startsWith("https:") ? "noreferrer" : undefined}>
        {email ? "Enviar e-mail sobre privacidade" : config.whatsapp ? "Falar sobre meus dados no WhatsApp" : "Falar com a loja"}
      </a>
    </section>
  </article>;
}
