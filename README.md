# BAITERMIN Build Tracker

Statisk dashboard til BMW F20 BAITERMIN-buildet.

## Funktioner
- Op til 3 tilbud pr. produkt
- Laveste pris fremhæves automatisk
- Totalpris ud fra laveste aktuelle pris
- Markér produkter som købt (gemmes i browserens localStorage)
- Status: Køb nu / Afhænger af valg / Senere / Afvent
- Produktdata ligger i `data/products.json`

## Lokal kørsel
Åbn mappen via en lokal webserver, fx:

```bash
python -m http.server 8080
```

og gå til http://localhost:8080
