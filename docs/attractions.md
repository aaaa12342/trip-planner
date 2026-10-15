# 景点补充记录

补充日期：2026-10-07。数据文件：`js/city-attractions.js`。

本次为原本没有本地景点的 8 个城市各补充 4 个景点，共 32 个。本地城市景点总数从 183 增至 215；另有 71 个独立景区目的地，两者分别统计。

| 城市 | 新增景点 |
|---|---|
| 石家庄 | 河北博物院、隆兴寺、正定南城门、赵州桥 |
| 太原 | 晋祠、山西博物院、双塔寺、汾河公园 |
| 沈阳 | 沈阳故宫、张学良旧居陈列馆、北陵公园（清昭陵）、中街 |
| 大连 | 星海广场、老虎滩海洋公园、棒棰岛景区、大连森林动物园 |
| 长春 | 伪满皇宫博物院、净月潭、长影旧址博物馆、长春世界雕塑园 |
| 合肥 | 包公园、逍遥津公园、安徽博物院（蜀山馆）、三河古镇 |
| 南昌 | 滕王阁、南昌八一起义纪念馆、八一广场、江西省博物馆 |
| 福州 | 三坊七巷、西湖公园、福建博物院、鼓山 |

每条包含名称、规划参考坐标、分类、建议游览时长、简介、看点及交通提示。坐标为近似位置，未逐一核验导航入口；时长为规划估算，不含跨城交通、排队或实时活动。没有写入未经核实的票价、营业时间、公交班次和演出时间。博物馆区分新老馆，远郊景点提示额外交通时间。

城市查询后直接使用本地景点，参与时间预算、地图标记、勾选编辑、存档和导出，不再依赖 Overpass 才能获得这些城市的景点。本次没有将城市内每个景点新增为独立搜索目的地。

## 参考资料

用于核对景点名称、基本类型和简介；不作为坐标或建议时长的测量依据。展馆和景区开放情况以出发时官方公告为准。

- 石家庄：[隆兴寺大悲阁重新开放（市政府）](https://www.sjz.gov.cn/columns/839b1981-330e-4901-aba5-6c392154ce03/202610/03/e4e63d36-8ddd-42e4-913b-3410e7bf1ca2.html)、[河北旅游线路（中国旅游报）](https://www.ctnews.com.cn/paper/att/202110/28/08b8fdaf-0134-417c-b3c1-05f57e19fe75.pdf)。
- 太原：[晋祠古韵](https://scjg.hebei.gov.cn/info/111090)。
- 沈阳：[辽宁省政府景区目录](https://www.ln.gov.cn/web/sqgk/whly/ajjq/sy/index.shtml)。
- 大连：[旅游热点区域（文化和旅游部）](https://www.mct.gov.cn/whzx/qgwhxxlb/ln/202205/t20220516_932980.htm)。
- 长春：[吉林省文化和旅游厅旅游线路](https://whhlyt.jl.gov.cn/ztzl/jlslyxlhxj/gdxl/zcs/zcs_424332/202507/t20250704_9272967.html)、[净月潭景区](https://www.ijingyuetan.com/index.php/specialvieww/ziranjingguan)、[雕塑园（文化和旅游部）](https://sjfw.mct.gov.cn/site/dataservice/culdetails?curId=10&id=34836)。
- 合肥：[安徽博物院官网](https://www.ahm.cn/)、[合肥园林与古镇介绍（中国南方航空）](https://www.csair.com/h5/cn/tourism_strategy/guonei_lvyougonglve/Hefei2/1cfejsrv2f2tb.shtml)。
- 南昌：[市政府文旅线路](https://www.nc.gov.cn/ncszf/jrnc/202308/db8aacb5c357445c8991173b9e0b968d.shtml)、[江西省博物馆介绍](https://gd.huaxia.com/c/2023/08/28/1771202.shtml)。
- 福州：[三坊七巷（市政府）](https://www.fuzhou.gov.cn/zgfzzt/zjrc/mdfc/lswh/201109/t20110913_129365.htm)、[福建博物院（文化和旅游部）](https://zhuanti.mct.gov.cn/fujianbwg2022.html)。

## 验证

结构校验与城市查询覆盖新增 32 条数据；全量 1,746 种目的地与天数组合检查预算、景点唯一性和数据保留。浏览器在 Overpass 返回失败时逐一生成上述 8 个城市的四天行程，确认每个城市都有 4 个可编辑的本地景点且未发起景点检索请求。住宿模块仍可能请求交通枢纽，失败时按现有规则降级。网络服务使用模拟响应，线上可用性不在验证结论内。
