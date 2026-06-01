# Style Pack Specification — 風格圖庫規格

> 給 **Codex**(或任何圖庫產生者)的對接規格。
> 前端的風格切換器 (`styleRegistry.js` + `assetLoader.js`) 會嚴格依照本文件
> 載入素材包。只要你產出的資料夾與 `manifest.json` 符合此 schema,
> 前端**無需改動**即可吃到新的小鎮風格。

本文件是兩邊(前端程式 / 圖庫產生)的**唯一真實來源 (single source of truth)**。
若需新增欄位,先更新本文件,雙方再各自實作。

---

## 1. 總覽:一個「風格包 (style pack)」是什麼

一個風格包 = **一個資料夾** + **一份 `manifest.json`** + **N 個 PNG 素材**。

```
assets/
├── styles.json                ← 風格總清單(由前端維護,見 §6)
├── flower/                     ← 風格包 1(內建,程式內另有程序化 builder 後備)
│   ├── manifest.json
│   ├── thumbnail.png           ← 風格切換器顯示的縮圖(選填)
│   ├── grass.png
│   ├── house.png
│   ├── newAsset/               ← 此風格自帶的特殊命名素材(選填)
│   └── … (每個 asset 一張 PNG)
├── default/                    ← 風格包 2
│   ├── manifest.json
│   ├── thumbnail.png
│   └── …
└── santorini/                  ← 風格包 3(未來新增)
    └── …

# 注意:runtime 的 assets/ 只放各風格資料夾 + styles.json。
# 原始/中間素材(raw、raw_pending 等)請放在專案層級的 asset-sources/,
# 不要放進 assets/,以免被部署打包、也讓 assets/ 保持乾淨好維護。
```

**每個風格包必須是自包含的**:它要涵蓋下方 §4 的「必備 asset 清單」全部 id。
前端切換風格時會整包換掉,不會跨風格混用素材。

---

## 2. `manifest.json` Schema

每個風格資料夾根目錄放一份 `manifest.json`。頂層結構:

```jsonc
{
  "id": "santorini",                  // 必須等於資料夾名,小寫、無空格
  "name": "Santorini",                // 顯示名稱(UI 上顯示)
  "description": "藍頂白牆的愛琴海小鎮", // 選填,風格切換器的副標
  "thumbnail": "thumbnail.png",       // 相對本資料夾的縮圖路徑
  "version": 1,                       // schema 版本,目前固定 1
  "assets": [                         // 素材陣列,見下方逐欄說明
    {
      "id": "grass",
      "name": "Grass",
      "category": "terrain",
      "kind": "terrain",
      "footprint": { "w": 1, "d": 1 },
      "filename": "grass.png",
      "sizeScale": 1
    },
    {
      "id": "house",
      "name": "House",
      "category": "buildings",
      "kind": "object",
      "footprint": { "w": 2, "d": 2 },
      "filename": "house.png",
      "sizeScale": 1
    }
    // … 其餘 asset
  ]
}
```

### 2.1 每個 asset 物件的欄位

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `id` | string | ✅ | 唯一識別碼。**必須**用 §4 規定的標準 id(這樣存檔可跨風格沿用)。小寫 + 底線。 |
| `name` | string | ✅ | UI 顯示名稱。 |
| `category` | string | ✅ | 調色盤分類,**只能**是:`terrain` / `nature` / `props` / `water` / `buildings`。 |
| `kind` | string | ✅ | `terrain`(取代地面格)或 `object`(疊在地面上)。 |
| `footprint` | `{w,d}` | ✅ | 佔用的格子數(整數)。多數 1×1;建築可 2×2、3×3、4×4。 |
| `filename` | string | ✅ | 相對本風格資料夾的 PNG 路徑。建議直接用 `<id>.png`。 |
| `sizeScale` | number | ✅ | 視覺佔格寬比例(見 §3.3)。1.0 = 填滿格寬;0.4 = 小道具。與 footprint **解耦**。 |
| `noShadow` | bool | ⬜ | PNG 已自帶接地陰影時設 true,關閉引擎投影陰影。預設 false。 |
| `flatBase` | bool | ⬜ | PNG 底邊就是物件的腳(沒有畫底座)。設 true 會把底邊錨在格子前角。預設 false。 |
| `fitCell` | bool | ⬜ | 高解析物件直接縮到格寬,不重新合成進低解析 tile canvas。大型自帶底座的物件建議 true。 |
| `shadowStyle` | string | ⬜ | `cast`(預設,投影剪影)或 `contact`(低矮道具在正下方畫小接地陰影)。 |
| `tileLike` | bool | ⬜ | 地形類無縫鋪滿格子時設 true(grass/path/sand/stone/water 這類)。 |

> ⚠️ 前端不再需要 `builder`(程序化 fallback)欄位 —— 那只在 mykonos 開發期用,
> 由前端維護。Codex 產生的風格包**不需提供** builder。

---

## 3. PNG 素材製作規範

### 3.1 等距投影 (isometric) 對齊

遊戲是 **2:1 等距網格**,單格 64px 寬 × 32px 高(螢幕投影)。
所有素材必須用 **2:1 dimetric**(從上方約 30° 俯視)的視角繪製,光源**從左上打下**,
陰影落向右下,保持全風格一致。

### 3.2 解析度與格式

- 格式:**PNG**,帶 **透明背景 (alpha)**。背景必須完全透明,不可有白底或棋盤格。
- 解析度:以高解析輸出,**素材主體建議至少對應 4–6× 的螢幕參考尺寸**
  (1×1 格約 256–384px 寬;4×4 建築可到 1024px+ 寬)。前端會在載入時依
  螢幕與縮放降採樣,所以**寧可大不要小**,但不要超過 ~2048px 邊長以免拖慢載入。
- 一個 asset 一張 PNG,檔名 = `<id>.png`。

### 3.3 構圖、錨點與 `sizeScale`

這是最容易出錯的部分,務必照做:

- **物件 (`kind:"object"`)**:把物件畫在透明畫布**中央偏下**,讓「腳」落在畫布
  水平中線附近。前端會把物件中心對齊格子中心。
- **`sizeScale`** 控制物件視覺上佔格寬的比例,與 footprint 分開:
  - 牆 / 拱門 / 圍籬等建築構件:`0.7–1.0`(要和鄰格對齊)
  - 樹 / 大型植物:`0.6–0.9`
  - 一般道具(長椅、箱子):`0.4–0.6`
  - 小物(罐、桶、花盆、鵝卵石):`0.3–0.45`
- **`flatBase:true`** 用於沒有畫底座、底邊即物件腳的素材(欄杆、海牆、花圃)。
- **地形 (`kind:"terrain"`, `tileLike:true`)**:畫成**單一菱形 tile**,
  填滿 2:1 菱形(寬:高 = 2:1),邊緣可無縫拼接。不要畫陰影或立體底座。

### 3.4 風格一致性

同一風格包內,**所有素材的調色盤、筆觸、光影方向、線條粗細必須一致**,
看起來像同一位畫師畫的一套。縮圖 `thumbnail.png`(建議 512×512)
要能代表這個風格的整體氛圍。

---

## 4. 必備 Asset 清單(標準 id)

**每個風格包都必須提供以下全部 id**(這樣使用者切換風格時佈局不會破洞,
存檔也能跨風格套用)。名稱可在地化,但 `id`、`category`、`kind`、典型 `footprint` 要照表。

### terrain(地形,kind=terrain)
| id | 典型 footprint | tileLike | 說明 |
|---|---|---|---|
| `grass` | 1×1 | ✅ | 草地 |
| `path` | 1×1 | ✅ | 石板路 |
| `sand` | 1×1 | ✅ | 沙地 |
| `stone` | 1×1 | ✅ | 石地 |
| `water` | 1×1 | ✅ | 水面 |
| `stairs` | 1×1 | | 階梯(noShadow) |
| `sea_wall` | 1×1 | | 海牆(flatBase, fitCell, noShadow, sizeScale≈0.7) |

### nature(自然,kind=object)
`cypress` (絲柏), `bougainvillea` (九重葛), `olive` (橄欖樹), `agave` (龍舌蘭),
`dry_grass` (枯草), `flower_pot` (花盆)

### props(道具,kind=object)
`low_wall`, `blue_railing`, `corner_wall`, `gate_fence`, `archway`,
`lantern_post`, `stone_lantern`, `hanging_lantern`, `bench`, `signpost`,
`banner`, `crate`, `hay_bale`, `storage_box`, `wood_pile`, `water_bucket`,
`pottery_jar`, `terracotta_pot`, `stone_basin`, `rocks`, `large_rock`,
`mossy_stone`, `flat_stone`, `pebbles`, `stone_pile`, `boulder`

### water(水景與庭園,kind=object)
| id | footprint | 備註 |
|---|---|---|
| `small_bridge` | 2×1 | 橋 |
| `well` | 1×1 | 水井 |
| `garden_bed` | 1×1 | flatBase, fitCell, noShadow |
| `crop_patch` | 1×1 | flatBase, fitCell, noShadow |
| `veg_garden` | 1×1 | flatBase, fitCell, noShadow |

### buildings(建築,kind=object)
| id | footprint |
|---|---|
| `house` | 2×2 |
| `two_story` | 3×3 |
| `cube_house` | 2×2 |
| `terrace_house` | 3×2 |
| `pergola_house` | 3×3 |
| `villa` | 4×4 |
| `altar` | 2×2 |
| `tower_chapel` | 2×2 |
| `main_chapel` | 3×3 |
| `windmill` | 2×2 |

> 你可以**新增**額外 asset(用新的 id),但前端只保證上述標準 id 能跨風格存檔互通。
> 新增的非標準 id 在切換到不含它的風格時會被忽略。

---

## 5. 時間軸階段標籤(選填但建議)

時間軸功能會把小鎮拆成 0→100 的分階段建造順序。前端預設用 `category` 與
`kind` 推斷階段,但你可以在 asset 上加 `buildStage` 覆寫,讓建造節奏更合理:

```jsonc
{ "id": "house", "...": "...", "buildStage": "housing" }
```

可用階段(由早到晚):
`ground`(地基/地形) → `water`(水) → `paths`(道路) →
`walls`(牆/圍籬) → `details`(小物件/自然) → `housing`(住宅) → `landmarks`(地標)

未指定時的預設推斷:terrain→ground(water tile→water)、props 牆類→walls、
其餘 props/nature→details、buildings→housing(chapel/windmill/villa→landmarks)。

---

## 6. `assets/styles.json`(風格總清單)

前端讀這份檔來列出所有可選風格。**新增風格時,把一筆加進這個陣列**:

```jsonc
[
  { "id": "mykonos",   "name": "Mykonos",   "thumbnail": "mykonos/thumbnail.png" },
  { "id": "santorini", "name": "Santorini", "thumbnail": "santorini/thumbnail.png" }
]
```

`id` 必須對應到 `assets/<id>/manifest.json`。

---

## 7. 交付檢查清單 (Codex 自檢)

- [ ] 資料夾名 = manifest `id`,小寫無空格
- [ ] `manifest.json` 通過 §2 schema,涵蓋 §4 全部必備 id
- [ ] 每個 asset 的 `filename` PNG 都存在、透明背景、2:1 等距、光源左上
- [ ] `thumbnail.png` 存在且能代表風格
- [ ] 已把該風格加進 `assets/styles.json`
- [ ] PNG 邊長皆 ≤ 2048px,主體解析度足夠(1×1 ≥256px 寬)
- [ ] 全包視覺風格一致

交付這樣一個資料夾後,前端風格切換器即可直接載入,無需任何程式改動。
