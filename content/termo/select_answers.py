#!/usr/bin/env python3
"""Curated answer selection: hand-picked normalized forms, ranked by corpus
frequency, top 400 kept. Picks were made word-by-word against the answer
constraints (common contemporary pt-BR, lemma-preferred, no proper nouns,
no loanwords not naturalized, no obscenity, variety of POS and patterns)."""

import os

BASE = os.path.dirname(os.path.abspath(__file__))

PICKS = """
muito agora entao sobre assim nunca ainda antes menos quase desde longe perto
tanto acima ontem enfim tarde porem alias junto breve atras

fazer dizer ficar falar estar saber pegar matar levar ouvir parar poder comer
tomar mudar viver tirar pagar achar pedir ligar jogar casar andar beber abrir
lutar tocar fugir bater lidar criar subir virar obter morar mexer lavar fumar
mover pular nadar votar valer durar cacar calar puxar negar curar temer cavar
expor atuar girar ceder adiar errar rever jurar pisar guiar medir pesar secar
punir armar rodar gerar vazar sujar supor impor citar notar ferir sumir trair
botar rolar focar rezar odiar deter dever haver depor

coisa tempo noite favor homem lugar mundo filho filha carro amigo amiga parte
gente jeito irmao forma ajuda manha sorte morte papai mamae porta razao ideia
corpo chefe conta terra droga causa festa culpa plano filme calma livro resto
sinal grupo rosto linha idade crime local rapaz campo lista sonho ordem hotel
caixa monte banco fundo carta papel prova barco roupa vista padre epoca carne
teste saude passo chave clube corte vinho saida raiva serie banho bolsa bomba
preco nivel pista radio danca braco lider risco piada busca visao video praia
navio pedra peixe perna beijo troca apoio banda valor leite marca vento briga
palco ponte noiva noivo perda calor porco fonte casal chuva baile aviso grana
roubo lance primo prima peito humor curso licao posto venda golpe reino canto
prato vazio opcao genio exame queda corda massa regra torre placa conto bolso
motor folga carga bruxa areia senso cofre canal tribo vidro salao copia torta
pulso cobra nacao crise molho metal terno clima ganho ritmo museu falha febre
uniao moral ponta porto piano lenda ficha coroa turno cargo tunel barba ombro
turma prata moeda letra calca secao tinta frota prazo frase pausa creme cinto
tenis salto conde media dente arroz atriz drama sabor julho junho folha grama
dobro alibi circo rocha ideal midia custo setor selva posse abril firma parto
senha dolar couro pasta viuva barra trono album termo turne feira loira tigre
juizo milho traje vinda idolo aluno aluna duzia terca dieta radar beira macho
surra deusa texto lucro chute bloco poema nuvem praga cinza blusa curva faixa
forno ninho mafia boate abuso grito rifle refem renda duelo opera pilha touro
pesca bingo fluxo acido greve aguia lanca tumor duque lenco testa ciclo patio
fusao balde limao poeta gesto cabra barao autor gripe cesta multa bispo metro
lapis vapor mosca zumbi susto tenda farsa fruta cauda tampa bonus fardo punho
balao vilao femea furia lesao delta manga cueca verme servo coral altar culto
pouso pacto arabe ciume missa sabao berco etica leito bicho etapa pudim chapa
casca brisa exito farol serra jaula ruido tropa tumba borda astro boato juiza
arena lenha sonda fator freio norma credo casco vodca monge grade batom trigo
poste pocao bolha sitio rival peste latim palma tosse tedio juros fruto ruiva
balsa fogao pinta fedor apelo licor loiro milha nevoa ganso tocha globo palha
fibra corvo usina tango garfo ruina apito golfo rumor quilo sogra pilar terco
afeto fatia genro verso arame galho manto prego panda capuz tabua ronda flora
garra pombo esqui porte traco orfao gemeo lagoa rampa gasto sotao verao

certo claro feliz legal forte unico otimo serio louco lindo livre preso jovem
baixo velho morto capaz pobre cheio longo igual justo comum limpo bravo falso
exato firme curto medio gordo doido burro nobre atual civil cruel calmo grave
duplo suave fraco chato obvio grato lento solto digno surdo fatal vital anual
sutil tenso tonto magro farto ativo frito sexto bruto largo macio umido meigo
irado tinto feroz grego turco sueco russo

cinco vinte treze

estou vamos tenho quero posso disse mesmo outro algum ambos sexta minha nossa
"""


def main() -> None:
    picks = []
    seen = set()
    for w in PICKS.split():
        if w not in seen:
            seen.add(w)
            picks.append(w)
    print(f"hand-picked (deduped): {len(picks)}")

    # candidate pool: normalized -> (freq, canonical)
    pool = {}
    with open(f"{BASE}/candidates.tsv", encoding="utf-8") as f:
        for line in f:
            freq, norm, canon, _forms = line.rstrip("\n").split("\t")
            pool[norm] = (int(freq), canon)

    validation = set(open(f"{BASE}/validation.txt", encoding="utf-8").read().split())

    missing = [w for w in picks if w not in pool]
    not_valid = [w for w in picks if w not in validation]
    if missing:
        print("NOT IN CANDIDATE POOL (dropped):", missing)
    if not_valid:
        print("NOT IN VALIDATION (bug!):", not_valid)

    usable = [w for w in picks if w in pool and w in validation]
    usable.sort(key=lambda w: -pool[w][0])
    answers = usable[:400]
    print(f"usable: {len(usable)}; kept: {len(answers)}")
    if len(answers) < 400:
        print("WARNING: fewer than 400")

    cut = usable[400:]
    print(f"cut by frequency rank ({len(cut)}):", " ".join(cut[:60]))

    with open(f"{BASE}/answers.csv", "w", encoding="utf-8") as f:
        f.write("canonical,normalized\n")
        for w in answers:
            f.write(f"{pool[w][1]},{w}\n")

    # frequency floor of the kept set
    print("lowest-frequency kept:", [(w, pool[w][0]) for w in answers[-5:]])


if __name__ == "__main__":
    main()
