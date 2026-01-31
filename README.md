# Soccer Runner

Gra przeglądarkowa typu runner z widokiem top-down, sterowana prawdziwą piłką przez kamerę (Computer Vision).

## Uruchomienie

```bash
cd C:\Users\ACER\Desktop\SoccerRunner
python server.py
```

Otwórz w przeglądarce: **http://localhost:8000**

## Sterowanie

| Metoda | Opis |
|--------|------|
| **Piłka (CV)** | Przesuń kolorową piłkę przed kamerą |
| **Klawiatura** | Strzałki: ← → ↑ ↓ (fallback) |
| **Spacja** | Start gry |

## Kalibracja koloru piłki

Domyślnie wykrywana jest **pomarańczowa piłka**. W menu można dostosować:
- **Hue Min/Max** - zakres odcienia (H w HSV)
- **Saturation Min** - minimalne nasycenie
- **Value Min** - minimalna jasność

## Algorytm CV

```
1. Pobierz klatkę z kamery (getUserMedia)
2. Konwertuj RGB → HSV
3. Stwórz maskę binarną dla koloru piłki
4. Oblicz centroid (środek masy) białych pikseli
5. Wygładź pozycję (exponential smoothing)
6. Mapuj współrzędne kamery → gra
```

## Struktura projektu

```
SoccerRunner/
├── index.html      # Struktura HTML
├── game.js         # Logika gry + CV
├── styles.css      # Style
├── server.py       # Serwer lokalny
└── README.md       # Dokumentacja
```

---

## INSTRUKCJA DLA CLAUDE (rozszerzanie projektu)

### Prompt bazowy

```
Pracujesz nad projektem SoccerRunner - grą przeglądarkową z detekcją piłki przez kamerę.

ISTNIEJĄCY KOD:
- game.js zawiera pełną logikę CV (HSV threshold, centroid, smoothing)
- Funkcja detectBall() wykrywa piłkę i zwraca znormalizowane współrzędne [0-1]
- Smoothing przez exponential moving average (CONFIG.smoothingFactor)
- Mapowanie z uwzględnieniem dead zone

ZASADY:
1. Nie modyfikuj działającego algorytmu CV bez potrzeby
2. Używaj state.smoothedBall.x/y jako źródła sterowania
3. Nowe przeszkody dodawaj do state.obstacles[]
4. Kolizje sprawdzaj w checkCollisions()
5. Renderowanie w renderGame()

DOSTĘPNE KONFIGURACJE:
- CONFIG.color.hueMin/Max, satMin, valMin - kolor piłki
- CONFIG.smoothingFactor - wygładzanie (0.05-0.3)
- CONFIG.deadZone - strefa martwa w środku
- CONFIG.gameWidth/Height - wymiary planszy
- CONFIG.ballRadius - rozmiar piłki gracza
- CONFIG.initialSpeed - początkowa prędkość
```

### Przykładowe zadania

**Dodanie power-upów:**
```
Dodaj power-upy do SoccerRunner:
- Gwiazdka (żółta) - podwaja punkty na 5s
- Tarcza (niebieska) - nieśmiertelność na 3s
- Spawn co 10 sekund
- Kolizja z piłką gracza aktywuje efekt
```

**Zmiana typu przeszkód:**
```
Zamień statyczne przeszkody na:
- Ruchome bloki (lewo-prawo)
- Obracające się przeszkody
- Przeszkody różnej wielkości
```

**Dodanie poziomów:**
```
Dodaj system poziomów:
- Poziom 1: wolno, mało przeszkód
- Poziom 2: szybciej, więcej przeszkód
- Poziom 3: ruchome przeszkody
- Przejście po zdobyciu X punktów
```

**Multiplayer lokalny:**
```
Dodaj drugiego gracza:
- Druga piłka innego koloru (np. zielona)
- Osobna detekcja CV z innymi progami HSV
- Split screen lub wspólna plansza
```
