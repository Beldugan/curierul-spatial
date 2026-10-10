# 🚀 Curierul spațial

Joc de fizică pentru **Fizica distractivă 05 — Leneșul, greul și împingerea înapoi**: inerția, masa ca măsură a inerției și acțiunea-reacțiunea. E gândit pentru un copil de 8–9 ani (Year 4, sistemul britanic). Copilul pilotează o navă de marfă până la o stație spațială. În spațiu nu există frecare, așa că fizica nu mai e ascunsă: devine chiar regula jocului. Fără biblioteci externe, fără internet: dublu-click pe `index.html`.

## Cele patru misiuni

| # | Misiunea | Principiul | Ce se întâmplă |
|---|---|---|---|
| 1 | **Primul zbor** | inerția | Un singur puf, iar nava merge la nesfârșit. Ca să andochezi sub 1,5 m/s trebuie să frânezi cu un puf în sens **opus**. Aceeași idee pe verticală: un puf în sus pornește nava, iar ca s-o oprești trebuie un puf în jos. |
| 2 | **Containerul greu** | masa | Nava (1 t) prinde un container de 2 t. Căsuța „Un puf schimbă viteza cu” scade de la **1,00** la **0,33 m/s**. În clipa prinderii, nava încetinește singură, pentru că containerul „leneș” o ține în loc. |
| 3 | **Fără combustibil!** | acțiune–reacțiune | Un astronaut în derivă, fără combustibil, se poate întoarce la stație doar **aruncând obiecte**: cheia (2 kg), ciocanul (4 kg), cutia cu scule (10 kg). Arunci spre stânga și ești împins spre dreapta. Cu cât obiectul e mai greu, cu atât împingerea e mai mare. Săgețile roșie și albastră sunt mereu egale. |
| 4 | **Livrare de urgență** | toate trei | Un container de 4 t, un culoar printre asteroizi și o andocare sub 1 m/s, cu combustibil puțin. |

La fiecare puf apar flacăra și **două săgeți egale, în sensuri opuse**: gazul într-o parte, nava în cealaltă. Săgeata verde arată în permanență viteza, deci și inerția: nava merge pe direcția ei până primește un alt puf.

La final, fiecare misiune reușită dă **1–3 stele**, după cât de puțin combustibil (sau câte puține obiecte) ai folosit, și deschide o fișă **„Ai descoperit”** cu un exemplu **„În viața reală”**: centura de siguranță, coșul de supermarket plin, rachetele, rucsacul-rachetă SAFER al astronauților, navele de marfă care aprovizionează Stația Spațială Internațională. Stelele rămân salvate în browser (12 în total).

**Testul de pilot**: 6 întrebări cu explicație imediată, cu variantele amestecate la fiecare reluare.

## Fizica din spatele jocului

- 1 m = 50 px. Un puf este o împingere fixă de **1 t·m/s**, deci un puf schimbă viteza cu **1 / masă**. Asta e legea a II-a, spusă pe limba copilului: *masă mare = schimbare mică*.
- La prinderea containerului se conservă impulsul: viteza navei se împarte la masa totală.
- La aruncarea unui obiect: viteza astronautului se schimbă cu *masa obiectului × 10 m/s / masa rămasă*. Se conservă impulsul.
- Fără frecare și fără gravitație în scenă: tot ce se mișcă își păstrează viteza.

## Comenzi

Butoanele mari ▲ ◀ ▶ ▼ (merg pe tabletă și telefon) sau săgețile / WASD de pe tastatură. Fiecare apăsare = **un singur puf**. Ținerea apăsată nu trage continuu, ca să se poată număra pufurile.

## Caracteristici

- **Bilingv RO / EN**, cu comutare instantanee din antet (util pentru vocabularul de la școala britanică: *force, push, pull, mass, inertia*)
- Temă deschisă / întunecată, memorată în browser
- Merge pe telefon, tabletă și calculator
- Zero dependențe, zero trafic de rețea

## Structura

```
index.html
assets/
  css/style.css   – stilul comun al seriei
  css/game.css    – stilul jocului
  js/i18n.js      – toate textele RO/EN
  js/app.js       – fizica, misiunile, desenul și quizul
.github/workflows/pages.yml
```

## Publicare pe GitHub Pages

1. Creează un repository gol numit `curierul-spatial`.
2. Din folderul aplicației:
   ```bash
   git init && git add . && git commit -m "Prima versiune"
   git branch -M main
   git remote add origin https://github.com/Beldugan/curierul-spatial.git
   git push -u origin main
   ```
3. *Settings → Pages → Source*: **GitHub Actions**.

## Licență

Codul: MIT (vezi `LICENSE`). Conținutul didactic poate fi folosit liber la clasă, cu menționarea sursei experimentelor (V. Atanasiu, *Fizica distractivă*, 1964).
