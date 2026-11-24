"use client";

import { FormEvent, useState } from "react";
import { HDKey } from "@scure/bip32";
import { generateMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { isAddress } from "viem";
import { useRouter } from "next/navigation";

type Currency = "btc" | "bch" | "eth" | "xmr";
type KeyMode = "xpub" | "generated";

const labels: Record<Currency, string> = { btc: "Bitcoin", bch: "Bitcoin Cash", eth: "Ethereum", xmr: "Monero" };

export default function WalletOnboarding({ email }: { email: string }) {
  const router = useRouter();
  const [currency, setCurrency] = useState<Currency>("btc");
  const [keyMode, setKeyMode] = useState<KeyMode>("xpub");
  const [phrase, setPhrase] = useState("");
  const [savedPhrase, setSavedPhrase] = useState(false);
  const [walletName, setWalletName] = useState("Bitcoin");
  const [storeName, setStoreName] = useState("Minha loja");
  const [destination, setDestination] = useState("");
  const [address, setAddress] = useState("");
  const [viewKey, setViewKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const mnemonicAllowed = currency === "btc" || currency === "bch";
  const derivationPath = currency === "bch" ? "m/44'/145'/0'" : "m/44'/0'/0'";
  const words = phrase ? phrase.split(" ") : [];

  function changeCurrency(value: Currency) {
    setCurrency(value);
    setWalletName(labels[value]);
    setPhrase("");
    setSavedPhrase(false);
    setDestination("");
    setAddress("");
    setViewKey("");
    setKeyMode("xpub");
    setError("");
  }

  function makePhrase() {
    setPhrase(generateMnemonic(wordlist, 128));
    setSavedPhrase(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    let target = destination.trim();
    let seed: Uint8Array | undefined;
    let root: HDKey | undefined;
    let account: HDKey | undefined;
    if (currency === "btc" || currency === "bch") {
      if (keyMode === "generated") {
        if (!phrase || !savedPhrase) {
          setError("Gere a frase e confirme que a salvou antes de continuar.");
          return;
        }
        try {
          seed = mnemonicToSeedSync(phrase);
          root = HDKey.fromMasterSeed(seed);
          account = root.derive(derivationPath);
          target = account.publicExtendedKey;
        } catch {
          setError("Não consegui derivar a chave pública no navegador.");
          return;
        } finally {
          seed?.fill(0);
          account?.wipePrivateData();
          root?.wipePrivateData();
        }
      } else {
        try {
          const key = HDKey.fromExtendedKey(target);
          if (!target.startsWith("xpub") || key.depth !== 3 || key.privateKey !== null || key.publicExtendedKey !== target) {
            setError("Informe um xpub de conta válido para a moeda escolhida.");
            return;
          }
        } catch {
          setError("Informe um xpub de conta válido para a moeda escolhida.");
          return;
        }
      }
    } else if (currency === "eth" && !isAddress(target)) {
      setError("Informe um endereço Ethereum válido.");
      return;
    } else if (currency === "xmr" && (!/^4[1-9A-HJ-NP-Za-km-z]{94}$/.test(address.trim()) || !/^[0-9a-fA-F]{64}$/.test(viewKey.trim()))) {
      setError("Confira o endereço Monero e a view key hexadecimal de 64 caracteres.");
      return;
    }

    setPending(true);
    try {
      const payload = {
        currency,
        walletName: walletName.trim(),
        storeName: storeName.trim(),
        ...(currency === "xmr" ? { address: address.trim(), viewKey: viewKey.trim() } : { destination: target }),
      };
      const response = await fetch("/api/wallets/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(response.status === 401
          ? "Sua sessão expirou. Entre novamente."
          : "Não foi possível configurar a carteira. Seus dados não foram salvos pelo Ágora; confira o Bitcart antes de tentar novamente.");
        return;
      }
      setPhrase("");
      setSavedPhrase(false);
      setViewKey("");
      router.push("/");
    } catch {
      setError("Não consegui confirmar a configuração. Confira a carteira e a loja no Bitcart antes de repetir.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-8">
      <section className="mx-auto max-w-2xl">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-[0.25em] text-emerald-400">CHECKOUT ÁGORA</p>
          <h1 className="mt-3 text-3xl font-semibold">Configure sua carteira</h1>
          <p className="mt-2 text-sm text-slate-400">Conta: {email}. A frase de recuperação, quando gerada, permanece somente nesta página do seu navegador.</p>
        </header>

        <form className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8" onSubmit={submit}>
          <label className="grid gap-2 text-sm">Moeda
            <select className="rounded-md border border-slate-700 bg-slate-950 p-3" value={currency} onChange={(event) => changeCurrency(event.target.value as Currency)}>
              {(Object.keys(labels) as Currency[]).map((item) => <option key={item} value={item}>{labels[item]}</option>)}
            </select>
          </label>

          {mnemonicAllowed ? <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Como conectar a carteira?</legend>
            <label className="flex gap-3 rounded-lg border border-slate-700 p-3 text-sm">
              <input type="radio" name="keyMode" checked={keyMode === "xpub"} onChange={() => { setKeyMode("xpub"); setPhrase(""); setSavedPhrase(false); }} />
              <span><strong>Já tenho um xpub</strong><span className="mt-1 block text-slate-400">Recomendado e pré-selecionado. O Bitcart observa a carteira sem controlar os fundos.</span></span>
            </label>
            <label className="flex gap-3 rounded-lg border border-slate-700 p-3 text-sm">
              <input type="radio" name="keyMode" checked={keyMode === "generated"} onChange={() => { setKeyMode("generated"); setDestination(""); }} />
              <span><strong>Criar nova carteira</strong><span className="mt-1 block text-slate-400">Gera 12 palavras no navegador e envia somente o xpub derivado ao Bitcart.</span></span>
            </label>
            {keyMode === "xpub" ? <label className="grid gap-2 text-sm">xpub
              <input className="rounded-md border border-slate-700 bg-slate-950 p-3 font-mono text-xs" value={destination} onChange={(event) => setDestination(event.target.value.trim())} autoComplete="off" required />
            </label> : <div className="grid gap-3 rounded-lg border border-amber-800/70 bg-amber-950/30 p-4">
              {!phrase ? <button className="w-fit rounded-md border border-amber-700 px-4 py-2 text-sm font-semibold hover:bg-amber-900" onClick={makePhrase} type="button">Gerar 12 palavras neste navegador</button> : <>
                <p className="text-sm font-semibold text-amber-200">Anote e guarde estas palavras agora. Elas não poderão ser recuperadas depois.</p>
                <ol className="grid grid-cols-2 gap-x-5 gap-y-2 rounded-md bg-slate-950 p-4 font-mono text-sm sm:grid-cols-3">
                  {words.map((word, index) => <li key={index}><span className="mr-2 text-slate-500">{index + 1}.</span>{word}</li>)}
                </ol>
                <label className="flex gap-3 text-sm"><input type="checkbox" checked={savedPhrase} onChange={(event) => setSavedPhrase(event.target.checked)} />Salvei as palavras em local seguro.</label>
                <p className="text-xs leading-5 text-amber-100/80">Derivação {derivationPath}. O Ágora envia ao Bitcart somente a chave pública; nunca envie essas palavras a ninguém.</p>
              </>}
            </div>}
          </fieldset> : null}

          {currency === "eth" ? <label className="grid gap-2 text-sm">Endereço Ethereum de destino
            <input className="rounded-md border border-slate-700 bg-slate-950 p-3 font-mono text-sm" value={destination} onChange={(event) => setDestination(event.target.value.trim())} autoComplete="off" required />
            <span className="text-xs text-slate-400">Para Ethereum, basta informar o endereço; nenhuma frase é gerada.</span>
          </label> : null}

          {currency === "xmr" ? <div className="grid gap-4">
            <label className="grid gap-2 text-sm">Endereço Monero
              <input className="rounded-md border border-slate-700 bg-slate-950 p-3 font-mono text-xs" value={address} onChange={(event) => setAddress(event.target.value.trim())} autoComplete="off" required />
            </label>
            <label className="grid gap-2 text-sm">View key (hexadecimal)
              <input className="rounded-md border border-slate-700 bg-slate-950 p-3 font-mono text-sm" value={viewKey} onChange={(event) => setViewKey(event.target.value.trim())} autoComplete="off" required />
            </label>
            <p className="text-xs leading-5 text-slate-400">A view key permite ao Bitcart acompanhar entradas, mas não gastar fundos. Ela será enviada ao Bitcart e armazenada lá; o Ágora não a persiste.</p>
          </div> : null}

          <label className="grid gap-2 text-sm">Nome da carteira
            <input className="rounded-md border border-slate-700 bg-slate-950 p-3" value={walletName} onChange={(event) => setWalletName(event.target.value)} maxLength={80} required />
          </label>
          <label className="grid gap-2 text-sm">Nome da loja no Bitcart
            <input className="rounded-md border border-slate-700 bg-slate-950 p-3" value={storeName} onChange={(event) => setStoreName(event.target.value)} maxLength={80} required />
          </label>
          {error ? <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p> : null}
          <button className="rounded-md bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50" disabled={pending || (keyMode === "generated" && mnemonicAllowed && !savedPhrase)} type="submit">
            {pending ? "Configurando carteira…" : "Criar carteira e continuar"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">Ao continuar, a carteira será registrada no Bitcart. Você irá para a tela atual de criação de links de pagamento.</p>
      </section>
    </main>
  );
}
