# 3D 鹈鹕兜风 🐦🚲

用 [three.js](https://threejs.org/) 做的 3D 小场景：一只鹈鹕骑着各种交通工具，沿着环形小路一圈一圈地兜风。
可以随意切换 **场景**、**装扮** 和 **座驾**，一共 5 × 10 × 6 = 300 种组合。

## 运行

浏览器的 ES 模块不能直接从 `file://` 加载，需要起一个本地静态服务器：

```bash
cd pelican-bicycle-3d
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>。three.js 通过 CDN（cdn.jsdelivr.net）加载，需要联网。

也可以用地址参数直接打开某个组合，例如：
`http://localhost:8000/?scene=moon&skin=astronaut&vehicle=skateboard`

## 内容

| 场景 `scene` | 装扮 `skin` | 座驾 `vehicle` |
| --- | --- | --- |
| 🌳 草地森林 `meadow`（风车、小花） | 🤍 经典白鹈鹕 `classic` | 🚲 自行车 `bicycle`（车筐里有鱼） |
| 🏖️ 海滩 `beach`（海浪、椰子树、帆船、海鸥、沙堡） | 🤎 褐鹈鹕 `brown` | 🎪 独轮车 `unicycle`（张开翅膀保持平衡） |
| ❄️ 雪地 `snow`（下雪、雪人、礼物） | 🌸 粉红泡泡 `pink`（小花 + 珍珠项链） | 🛴 滑板车 `scooter`（一只脚蹬地） |
| 🌃 城市夜景 `city`（亮灯的楼、路灯、喷泉） | 🎩 绅士 `gentleman`（礼帽、单片眼镜、领结） | 🛹 滑板 `skateboard` |
| 🌕 月球 `moon`（低重力会蹦、地球、登月舱） | 🏁 赛车手 `racer`（头盔、墨镜、围巾） | 🏍️ 摩托车 `motorcycle`（会冒烟） |
| | 🏴‍☠️ 海盗 `pirate`（海盗帽、眼罩、耳环） | 🚗 敞篷车 `car` |
| | 🤠 牛仔 `cowboy` | |
| | 🎅 圣诞老人 `santa` | |
| | 👨‍🚀 宇航员 `astronaut`（玻璃头盔、氧气瓶） | |
| | 👑 黄金国王 `golden`（金属质感 + 王冠） | |

## 操作

| 操作 | 效果 |
| --- | --- |
| 鼠标左键拖动 / 滚轮 / 右键拖动 | 旋转 / 缩放 / 平移视角 |
| 面板下拉框 | 切换场景、装扮、座驾 |
| S / D / V | 依次切换场景 / 装扮 / 座驾 |
| R 或「🎲 随机」 | 随机组合 |
| B 或「按铃」 | 按铃（自行车、滑板车）/ 按喇叭（摩托、汽车）/ 吹口哨（独轮车、滑板），鹈鹕会开心地抬头 |
| 空格 | 暂停 / 继续 |
| 速度滑块 | 调节速度 |
| 「跟随镜头」 | 开启时相机跟着鹈鹕移动 |

## 代码结构

| 文件 | 内容 |
| --- | --- |
| `main.js` | 渲染器、灯光、界面、动画循环、切换逻辑 |
| `pelican.js` | 鹈鹕模型；腿和翅膀用 IK 实时摆到交通工具给出的脚踏/握把位置 |
| `skins.js` | 装扮：配色 + 配饰（帽子、眼镜、围巾……） |
| `vehicles.js` | 交通工具：模型、座位、握把、脚的位置以及动画 |
| `scenes.js` | 场景：地面、小路、装饰、灯光、天空 |
| `utils.js` | 公共小工具 |

### 加一个新东西

- **新装扮**：在 `skins.js` 的 `SKINS` 里加一项，写好 `palette`，可选 `accessories({ head, body })` 往头上/身上挂东西。
- **新座驾**：在 `vehicles.js` 里写一个工厂函数，返回 `group / seat / grips / feet / update()` 等字段（文件顶部有说明），再加进 `VEHICLES`。
- **新场景**：在 `scenes.js` 里写一个函数，返回 `group / update / background / fog / hemi / sun`，再加进 `SCENES`。

所有模型都用 three.js 的基础几何体拼出来，没有外部模型文件。
