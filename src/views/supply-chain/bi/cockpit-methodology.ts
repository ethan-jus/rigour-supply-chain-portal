import type { SupplyDashboardOverview } from '@/api/core/bi'
import type { CockpitKpi, CockpitOptions, Figure } from './cockpit-model'
import { exactAmount, percent, ratio } from './cockpit-charts'
import { operatingCosts, sampleCostRules } from './cockpit-costs'

export interface MetricExplanation {
  id: string
  name: string
  formula: string
  source: string
  rules: string[]
  value?: string
  sample?: boolean
}

type Rule = Omit<MetricExplanation, 'id' | 'name'>
const orders = 'Order 销售订单 → BI 订单事实快照'
const payments = 'Order 回款记录 → BI 回款事实快照'
const products = 'Order 订单行 + ERP 商品、分类、品牌、SKU → BI 订单行事实快照'
const customers = 'CRM 客户档案 + Order 订单、回款 → BI 客户分析'
const inventory = 'ERP 采购、销售出库、库存余额 + Order 商品销量 → BI 库存分析'
const orderScope =
  '按订单日期选取期间，排除已取消、已逻辑删除订单；销售额是订单应收，不是商品行标价总和。'
const collectionScope =
  '累计已收以当前 BI 快照为准，可能包含所选订单在期后收到的款项；不是该期间的实际到账。'
const stockScope = '数量仅在相同原单位内汇总；箱、桶、瓶不直接相加，不根据单位名称自动换算。'

const rules = {
  cityContact: {
    formula: '城市建联客户 = 所选期间内 Sales 已提交且未删除的拜访涉及的去重门店数',
    source: 'Sales 临时打卡记录及门店目录 → BI 建联快照',
    rules: ['同一门店多次拜访只计1户，不要求微信截图；拜访结果不用于推断是否成功沟通。',
      '城市按门店当前城市归属；审核异常优先单列，其余分为已审核和待审核。',
      '不与 CRM 留资客户或下单客户混合计算转化率；销售筛选按提交人已确认的 HR 员工编码，未关联人员的拜访不计入个人统计。'],
  },
  sales: { formula: '销售额 = 所选订单应收金额之和', source: orders, rules: [orderScope] },
  paid: {
    formula: '回款额 = 所选订单累计已收金额之和',
    source: orders,
    rules: [orderScope, collectionScope],
  },
  unpaid: {
    formula: '待回款 = 所选订单未收金额之和',
    source: orders,
    rules: [
      '直接使用订单事实的未收金额，不在图表内按销售额减回款额重新覆盖。',
      '包括未到期和已逾期金额；负值、超额回款保留供核对，不强制改成零。',
    ],
  },
  rate: {
    formula: '回款率 = 同批订单累计已收金额合计 ÷ 同批订单应收金额合计 × 100%',
    source: orders,
    rules: [
      collectionScope,
      '整体回款率按金额合计计算，不是各城市、销售或订单回款率的算术平均。',
      '应收小于等于0或分子/分母缺失时显示“—”；超过100%或负值保留。仪表弧长限于0–100%，读数不截断。',
    ],
  },
  receipt: {
    formula: '期间实际回款 = 回款发生日期在所选期间内的回款记录金额之和',
    source: payments,
    rules: [
      '按回款发生时间归期，可能包含以前下单、本期到账的订单；不能与同期间订单应收直接相除当作订单回款率。',
      '人员筛选匹配归属销售或经办收款人；排行使用 BI 归属销售，不重复计算同一条回款。',
    ],
  },
  ranking: {
    formula: '按所选销售额或订单累计回款金额降序排列',
    source: orders + ' + CRM 销售归属 / HR 人员名称',
    rules: [
      '只纳入有明确销售归属的记录。全国指当前账号权限和筛选范围，不绕过城市或个人数据权限。',
      '金额相同并列名次，例如1、1、3；同金额用稳定人员标识排序。图中分页不改变完整返回名单的名次。',
      '前期名次取相邻等长期间的同项指标；前期没有记录显示“前期无记录”。这不是目标完成率或综合绩效考核。',
    ],
  },
  monthly: {
    formula:
      '在当前期间、当前权限和筛选范围内，按销售额降序取最多6位已归属销售，再按月汇总各人的订单销售额',
    source: orders,
    rules: [
      '同额按稳定人员标识排序；不足6人展示实际人数。这个选择是展示范围，不是重点员工或绩效评价。',
      '始终按销售额选择，不随全国榜的“累计回款”排序切换；查看其他人员可使用全国榜或顶部销售筛选。',
      '各小图共用金额刻度；月度无返回记录留空，不把缺失记录补成0；真实0仍显示0。末月只包含所选截止日之前的订单。',
    ],
  },
  trend: {
    formula: '按订单日期（日/月）分别汇总订单应收和这些订单的累计已收',
    source: orders,
    rules: [
      collectionScope,
      '两条线属于同一批订单；没有返回记录的日期留空，末月可能是不完整月份。',
    ],
  },
  comparison: {
    formula: '增减金额 = 本期值 − 前期值；变化率 = 增减金额 ÷ |前期值| × 100%',
    source: orders,
    rules: [
      '前期是紧邻本期、天数相同的订单期间，不自动等同自然月环比或同比。两期回款都累计至当前快照。',
      '前期无订单不评价涨跌；前期为0时只显示增减金额，不显示无限增长百分比。',
      '销售增减来源按城市增减绝对值取前6个，其余合并；销售人员变化只比较两期均有记录、变动绝对值最大的6人。',
    ],
  },
  targets: {
    formula: '达成率 = 同指标实际值 ÷ 已配置目标值 × 100%；缺口 = max(目标值 − 实际值, 0)',
    source: 'BI 经营目标配置 + Order/CRM 实际值',
    rules: [
      '按已配置月份与查询期间的交集计算实际值；部分月份未配置会标注，不把缺失目标当0或自动补齐。',
      '回款目标对应订单累计回款；合作客户是期间去重下单客户；留资客户是当前有效存量，仅支持单月比较。',
      '未配置、目标为0或细分筛选与目标范围不一致时，不作完整目标达成判断。',
    ],
  },
  product: {
    formula: '商品/分类/品牌/SKU销售额 = 匹配订单行成交金额之和',
    source: products,
    rules: [
      '分类来自 ERP 分类树，品牌与分类是独立维度；SKU是规格，缺失关联会单列，不用样例填补真实商品。',
      '型号按订单记录的SKU统计，例如皮头H与M应分别记录；只有“H/M”合并记录时不能反推各型号销量。不同单位不直接相加，商品回款需查看报表归属口径。',
      '分类筛选包含后代分类；单品订单行销售额不等于整单应收，不能直接用整单回款作为该商品回款。',
      '占比和累计贡献以图表使用的返回集合为分母；分类/品牌超过6项时显示前5项和“其他”，明细保留其他项的成员。',
    ],
  },
  cityProduct: {
    formula: '按城市 × 商品分类汇总订单行销售额',
    source: products,
    rules: [
      '按所选范围订单行销售额分别选前8个城市、前5个品类；图中不是全部组合，明细保留接口完整返回记录。',
      '缺少ERP分类关联的金额以“分类关联待核对”保留，即使未进入前5品类也单列；不能因此断言某个分类没有销售，未确认的商品和规格不会自动匹配。',
      '金额可按元核对；销量按原单位分组。缺失组合留空，不证明该城市一定没有销售。',
      '城市商品报表默认不分摊混单回款；只有手动选择分摊时按整单商品成交金额占比计算并标注“分摊回款”；不能精确归属的金额单列。',
    ],
  },
  productCustomers: {
    formula: '客户覆盖 = 购买该商品/分类/品牌/SKU的去重客户数',
    source: products,
    rules: ['同一客户买多个商品会出现在多项中，不能把各项客户数相加当作全体去重客户。'],
  },
  refund: {
    formula:
      '商品退款额 = 订单退款按订单行成交金额占比分配后的金额之和；销售净收入 = 商品行销售额 − 分摊退款',
    source: products,
    rules: [
      '退款分配与报表中手动选择的“回款分摊”是两套口径，不能混淆。',
      '已按退款排除规则未导入的记录不参与系统统计；普通付款流水不自动识别为退款。',
    ],
  },
  referenceCost: {
    formula: 'ERP采购参考成本 = Σ(订单行数量 × 匹配SKU采购参考单价)',
    source: products + ' + ERP 采购参考价',
    rules: [
      '仅覆盖有参考价的订单行，不是实际出库批次成本，也不含人工、房租、运费等完整经营费用。',
      '缺价行不据此推断为零成本；总覆盖率为0时前端不展示估算成本，部分覆盖时明确标为已覆盖参考价成本。',
    ],
  },
  costCoverage: {
    formula: '采购价覆盖率 = 有ERP采购参考价的订单行成交金额 ÷ 全部对应订单行成交金额 × 100%',
    source: products,
    rules: ['这是金额覆盖率，不是SKU个数覆盖率；采购参考价是否覆盖与完整经营费用是否入账无关。'],
  },
  grossProfit: {
    formula: '估算毛利 = 销售净收入 − ERP采购参考成本；估算毛利率 = 估算毛利 ÷ 销售净收入 × 100%',
    source: products,
    rules: [
      '看板总体估算毛利只在采购参考价覆盖率达到100%时展示；商品毛利图也只展示参考价完整的商品。',
      '低毛利图按毛利率从低到高排列，不代表已设置毛利预警阈值。源接口净收入为0时毛利率返回0。',
      '不含人工、仓租等费用，不是财务净利润；负毛利保留。',
    ],
  },
  cost: {
    formula:
      '经营成本 = 各城市费用之和；经营结余 = 销售额 − 经营成本；成本率 = 经营成本 ÷ 销售额 × 100%',
    source: 'BI 已入账城市成本 + 仅缺失成本城市的演示费用模型',
    rules: [
      sampleCostRules.actual,
      sampleCostRules.date,
      sampleCostRules.procurement,
      sampleCostRules.usage,
      '分项占比以所选分组金额为分母；明细中的“占总成本比重”仍以全部经营成本为分母。应收不为正时成本率不计算。',
    ],
  },
  human: {
    formula: '人力成本 = 底薪绩效 + 提成 + 激励 + 兼职',
    source: '城市费用分项；未接入的人力费用仅使用明确标记的样例',
    rules: [
      sampleCostRules.personnel,
      '不展示个人工资，不将真实城市未分项总额自动拆成人力；不能用于计算个人薪资或考核。',
    ],
  },
  skuSample: {
    formula:
      '货品采购 = 样例采购价 × 样例数量；损耗成本 = 货品采购 × 样例损耗率；含损耗成本 = 两项之和',
    source: '固定SKU演示批次（非ERP真实事实）',
    rules: [sampleCostRules.sku],
  },
  overdue: {
    formula: '逾期待回款 = 到期时间早于查询截止时间且未收金额 > 0 的订单未收金额之和',
    source: orders + ' + CRM 客户账期',
    rules: [
      '按订单业务日期选取期间，不是按系统创建或补录时间，也不是全历史逾期余额；排除取消、删除订单。账期缺失时投影使用30天。',
      '逾期客户数按这些订单的客户去重；高风险客户为至少有一笔跨日逾期（北京时间日期差大于0）、且该订单回款率不高于20%的客户。当天刚到期可计入逾期金额，但不计入跨日高风险客户。',
      '平均逾期天数为逾期未收订单的逾期天数算术平均，不按金额加权；城市/销售按逾期金额降序，不以低回款率直接判逾期。',
    ],
  },
  aging: {
    formula: '按客户账期到期日与查询截止日之差分组，汇总未收金额 > 0 的订单',
    source: orders,
    rules: [
      '分为未逾期、逾期1–30天、31–60天、60天以上；以北京时间日期计算，未跨日（0天）归未逾期桶。金额逾期按到期时刻判断，两者边界不同。',
      '仅含所选订单期间；负未收不进入账龄桶。到期日若仍缺失，当前接口归入未逾期，需核对账期，不应据此认定无风险。',
      '账龄金额合计仅统计正未收，可能高于保留负未收的顶部待回款；同一客户可跨多个账龄桶，各桶客户数不能直接相加当作去重总数。',
    ],
  },
  customerStock: {
    formula: '可用客户 = CRM有效客户数；留资客户 = 其中具有联系人或联系电话的客户数',
    source: customers,
    rules: ['客户档案是当前有效存量，不是所选期间新增客户；与期间合作客户不是同一统计基数。'],
  },
  repeat: {
    formula:
      '合作/下单客户 = 期间至少1笔非取消订单的去重客户；复购客户 = 期间至少2笔订单的去重客户；复购率 = 复购客户 ÷ 下单客户 × 100%',
    source: customers,
    rules: [
      '这是期间复购，不是历史买过且本期又购买的留存率；跨城市客户可能重复，各城市客户数不能直接相加。',
      '分母为0时不计算复购率。',
    ],
  },
  customerSegment: {
    formula:
      '客户按期间销售额降序，依据计入该客户之前的累计销售贡献分层：小于80%为A，80%至不足95%为B，其余为C',
    source: customers,
    rules: [
      '跨越80%或95%边界的整位客户留在前一层，因此实际占比可能超过界线；无销售或总销售不为正时为C。',
      '分层是销售贡献，不代表客户信用等级；客户数占比以当前分层客户总数为分母。',
    ],
  },
  churn: {
    formula: '待跟进 = 从未下单，或最近下单至查询截止日间隔满30天的客户',
    source: customers,
    rules: [
      '最近下单以截止日前历史订单计算，不仅看本期；30–59天为预警，60天及以上或从未下单为高风险。',
      '这是跟进优先级，不是已流失结论。顶部客户汇总是全范围，名单图只统计本次接口返回的优先客户，不能把两者当成相同总数。',
    ],
  },
  customerValue: {
    formula:
      '客户贡献 = 该客户所选期间订单应收金额；累计贡献率 = 排名前列客户销售额累计 ÷ 返回客户销售额合计',
    source: customers,
    rules: [
      '接口客户贡献名单按活跃度、销售额等优先返回；不是全量客户。此图再按销售额排列，累计占比仅基于返回集合。',
    ],
  },
  activityScore: {
    formula:
      '活跃度 = min(100, max(0, 订单数×12 + 回款记录数×8 + 最近下单得分 + min(销售额÷1000, 30)))',
    source: customers,
    rules: [
      '最近下单不足30天加30分，30–59天加15分，60天及以上加0分；无历史下单按长时间未下单处理。',
      '是系统规则评分，不是统计预测模型，也不是员工绩效；客户分层图未使用这个得分。',
    ],
  },
  stock: {
    formula:
      '采购、发货取所选期间ERP单据数量；留存取当前库存快照；历史留存为下架/历史商品仍留存的数量',
    source: inventory,
    rules: [
      stockScope,
      '采购/发货是期间流量，留存是当前存量，不能按“采购−发货=留存”直接核对；不重建任意历史时点库存。',
      '不支持的城市、销售、客户类型、订单来源筛选会暂停库存汇总，不显示伪联动数据。',
    ],
  },
  replenish: {
    formula:
      '日均销量 = 期间订货数量 ÷ 期间天数（含首尾日）；可售天数 = 可用库存 ÷ 日均销量；有期间销量时建议补货 = max(30×日均销量 − 可用库存 − 在途, 0)，零销量时建议补货为0',
    source: inventory,
    rules: [
      stockScope,
      '按商品和单位汇总，期间销量为订单数量口径；这是30天覆盖模型，不含供应商交期、最小起订量或季节性预测。',
      '有销量且库存不为正或可售天数≤7天为高风险；≤15天为中风险；无销量但有库存为慢销。无日销不计算可售天数。',
      '库存快照缺失时只显示日均需求，不计算采购建议；建议不自动生成或审批采购单。',
    ],
  },
  inventoryRisk: {
    formula:
      '按顺序判断重点库存项：历史/下架记录的可用、锁定、在途任一非零先判中风险；其余记录可用量≤0判高风险，可用量小于锁定量判中风险',
    source: inventory,
    rules: [
      '按接口返回的仓库/商品/SKU风险项计数，最多20项，不是全量风险数，也不是补货覆盖天数的风险分类。',
      '图中占比仅以本次返回风险项为分母；无库存快照不能判定无风险。',
    ],
  },
  campaign: {
    formula:
      '活动成交 = 样例活动销售额合计；费用产出比 = 活动销售额 ÷ 费用；触达转化率 = 下单客户 ÷ 触达客户 × 100%；剩余预算 = 预算 − 已用费用',
    source: '固定活动演示数据（非Order或CRM真实活动归因）',
    rules: [
      '全部为独立样例，不随经营筛选变化，不合入真实销售、客户或经营成本总额。',
      '费用产出比不是净利润ROI；总转化率用下单客户合计除触达合计，不取各活动转化率平均。样例未做跨活动客户去重。',
    ],
  },
  actions: {
    formula:
      '优先跟进不是综合评分：逾期金额最大的城市；返回名单中待回款最高的待跟进客户；首条有补货建议的商品',
    source: orders + ' + CRM 客户分析 / ERP 库存分析',
    rules: [
      '客户同待回款时再按销售额降序，客户页最多3位，其他适用页面最多1位；受当前接口返回范围限制。',
      '按当前专题保留相关事项，数量仅为本次推荐，不是全部待办；样例成本不触发真实预警或员工考核。',
    ],
  },
} satisfies Record<string, Rule>

type RuleKey = keyof typeof rules
const kpiRules: Record<string, RuleKey> = {
  销售额: 'sales',
  回款额: 'paid',
  待回款: 'unpaid',
  全部待回款: 'unpaid',
  回款率: 'rate',
  可用客户: 'customerStock',
  合作客户: 'repeat',
  复购客户: 'repeat',
  待跟进客户: 'churn',
  销售净收入: 'refund',
  退款额: 'refund',
  参考价估算成本: 'referenceCost',
  已覆盖参考价成本: 'referenceCost',
  采购价覆盖率: 'costCoverage',
  估算毛利: 'grossProfit',
  逾期待回款: 'overdue',
  逾期客户: 'overdue',
  平均逾期天数: 'overdue',
  经营成本: 'cost',
  经营结余: 'cost',
  成本率: 'cost',
  采购数量: 'stock',
  发货数量: 'stock',
  留存数量: 'stock',
  历史留存: 'stock',
  重点库存风险项: 'inventoryRisk',
  高风险: 'inventoryRisk',
  中风险: 'inventoryRisk',
  低风险: 'inventoryRisk',
  活动成交: 'campaign',
  活动费用: 'campaign',
  费用产出比: 'campaign',
  触达转化率: 'campaign',
}
const kpiFormulas: Record<string, string> = {
  可用客户: '可用客户 = 当前授权和筛选范围内CRM有效客户档案数',
  合作客户: '合作客户 = 所选订单期间至少有1笔非取消订单的去重客户数',
  复购客户: '复购客户 = 所选订单期间至少有2笔非取消订单的去重客户数',
  待跟进客户: '待跟进客户 = 从未下单或最近下单距查询截止日满30天的客户数',
  销售净收入: '销售净收入 = 商品行成交金额合计 − 按行成交金额占比分配的订单退款合计',
  退款额: '退款额 = 订单退款按对应订单行成交金额占比分配后的金额之和',
  估算毛利: '估算毛利 = 销售净收入 − ERP采购参考成本（仅完整覆盖参考价时展示）',
  逾期客户: '逾期客户 = 所选订单期间内，到期时间早于查询截止时间且未收金额大于0的去重客户数',
  平均逾期天数: '平均逾期天数 = Σ逾期未收订单的逾期天数 ÷ 逾期未收订单数；天数按北京时间日期差计算',
  经营成本: '经营成本 = 所选期间各城市已入账费用 + 明确标记为样例的缺失城市费用',
  经营结余: '经营结余 = 所选期间销售额 − 同范围经营成本',
  成本率: '成本率 = 同范围经营成本 ÷ 销售额 × 100%',
  采购数量: '采购数量 = 所选期间ERP采购数量之和（仅相同单位）',
  发货数量: '发货数量 = 所选期间ERP销售出库数量之和（仅相同单位）',
  留存数量: '留存数量 = 当前ERP库存快照中的留存数量之和（仅相同单位，不是期间净入库）',
  历史留存: '历史留存 = 当前库存快照中历史或下架商品的留存数量之和（仅相同单位）',
  重点库存风险项: '重点库存风险项 = 本次接口返回的库存风险记录数（最多20项，非全量）',
  高风险: '高风险 = 本次返回库存风险项中，风险等级为高的记录数',
  中风险: '中风险 = 本次返回库存风险项中，风险等级为中的记录数',
  低风险: '低风险 = 本次返回库存风险项中，风险等级为低的记录数',
  活动成交: '活动成交 = 样例活动销售额之和',
  活动费用: '活动费用 = 样例活动已用费用之和',
  费用产出比: '费用产出比 = 样例活动销售额合计 ÷ 样例活动费用合计',
  触达转化率: '触达转化率 = 样例活动下单客户数合计 ÷ 触达客户数合计 × 100%',
}
const figureRules: Record<string, RuleKey> = {
  trend: 'trend',
  'city-trend': 'trend',
  'receipt-trend': 'receipt',
  'collection-progress': 'rate',
  'city-collection-progress': 'rate',
  cities: 'rate',
  'sales-ranking': 'rate',
  'city-sellers': 'rate',
  'city-paid-rate': 'rate',
  'performance-ranking': 'ranking',
  'receipt-ranking': 'receipt',
  'monthly-sales': 'monthly',
  'sales-movement': 'comparison',
  'sales-growth': 'comparison',
  targets: 'targets',
  products: 'product',
  categories: 'product',
  brands: 'product',
  'city-products': 'cityProduct',
  'product-customers': 'productCustomers',
  refunds: 'refund',
  'sku-reference-cost': 'referenceCost',
  'product-profit': 'grossProfit',
  margins: 'grossProfit',
  'cost-coverage': 'costCoverage',
  'cost-bridge': 'cost',
  'cost-structure': 'cost',
  'city-costs': 'cost',
  'human-cost': 'human',
  'sku-costs': 'skuSample',
  'overdue-cities': 'overdue',
  'overdue-sales': 'overdue',
  aging: 'aging',
  'city-repeat': 'repeat',
  'city-contacts': 'cityContact',
  'customer-risk': 'customerSegment',
  segments: 'customerSegment',
  'segment-value': 'customerSegment',
  churn: 'churn',
  'customer-value': 'customerValue',
  'inventory-flow': 'stock',
  'inactive-stock': 'stock',
  coverage: 'replenish',
  replenishment: 'replenish',
  'risk-replenishment': 'replenish',
  'risk-levels': 'inventoryRisk',
  'risk-types': 'inventoryRisk',
  campaigns: 'campaign',
  conversion: 'campaign',
  'campaign-budget': 'campaign',
  'campaign-return': 'campaign',
}

export function hasMetricExplanation(kind: 'kpi' | 'figure', key: string): boolean {
  return key in (kind === 'kpi' ? kpiRules : figureRules)
}

export function buildMetricExplanations(
  data: SupplyDashboardOverview,
  kpis: CockpitKpi[],
  figures: Figure[],
  options: Pick<CockpitOptions, 'ownerStaffCode' | 'rankingMetric'>,
): MetricExplanation[] {
  const metric = (code: string) => data.metrics.find((item) => item.metricCode === code)?.value
  const rateExample = () => {
    const paid = metric('paid_amount'),
      sales = metric('sales_amount')
    return paid == null || sales == null
      ? '当前分子或分母未返回，不能计算。'
      : `当前计算：${exactAmount(paid)} ÷ ${exactAmount(sales)} × 100% = ${percent(ratio(paid, sales))}。使用原始金额计算，再格式化显示。`
  }
  const items: MetricExplanation[] = kpis.map((kpi) => ({
    ...(rules[kpiRules[kpi.label]] || {
      formula: kpi.definition || '该指标尚未提供完整计算说明，请核对来源。',
      source: 'BI 指标接口',
      rules: [],
    }),
    ...(kpiFormulas[kpi.label] ? { formula: kpiFormulas[kpi.label] } : {}),
    id: `kpi:${kpi.label}`,
    name: kpi.label,
    value: kpi.value,
    sample: kpi.sample,
    rules: [
      ...(rules[kpiRules[kpi.label]]?.rules || []),
      ...(kpi.label === '回款率' ? [rateExample()] : []),
      ...(kpi.definition ? [kpi.definition] : []),
    ],
  }))
  for (const figure of figures) {
    let key = figureRules[figure.id]
    if (figure.id === 'monthly-sales' && !figure.smallMultiples)
      key = options.ownerStaffCode ? 'trend' : 'comparison'
    const rule = rules[key]
    items.push({
      ...(rule || {
        formula: '该图尚未提供完整计算说明，请核对来源。',
        source: 'BI 分析接口',
        rules: [],
      }),
      id: `figure:${figure.id}`,
      name: figure.title,
      sample: figure.sample,
      rules: [
        ...(rule?.rules || []),
        ...(figure.note ? [figure.note] : []),
        ...(figure.empty && !figure.rows.length ? [`当前状态：${figure.empty}`] : []),
        ...(figure.collection ? [rateExample()] : []),
        ...(figure.smallMultiples
          ? [
              `当前展示${figure.smallMultiples.series.length}位：${figure.smallMultiples.series.map((series) => series.name).join('、')}。`,
            ]
          : []),
        ...(figure.id === 'performance-ranking'
          ? [`当前排序：${options.rankingMetric === 'paidAmount' ? '订单累计回款' : '销售额'}。`]
          : []),
        ...(figure.id === 'customer-risk' ? rules.churn.rules : []),
      ],
    })
  }
  items.push({ ...rules.actions, id: 'actions', name: '优先跟进选择依据' })
  if (figures.some((figure) => ['customer-risk', 'customer-value'].includes(figure.id)))
    items.push({ ...rules.activityScore, id: 'activity-score', name: '客户活跃度评分' })
  if (kpis.some((kpi) => kpi.label === '经营成本' && kpi.sample && kpi.value !== '—')) {
    const costs = operatingCosts(data)
    items.push({
      id: 'cost-assumptions',
      name: '本范围样例成本计算依据',
      sample: true,
      formula:
        '每项样例费用 = max(该城市销售额, 0) × 费用比例 + 日固定费用 × 查询天数；每项四舍五入到分后求和',
      source: '前端固定演示费用模型，不是ERP/HR真实费用',
      rules: (costs.rows.length
        ? costs.rows
        : [
            {
              name: '当前范围（未分城市）',
              sample: true,
              lines: costs.lines,
              assumption: undefined,
            },
          ]
      )
        .filter((row) => row.sample)
        .flatMap((row) => [
          `${row.name}：${row.assumption?.name || '样例'}。${row.assumption?.explanation || ''}`,
          ...row.lines
            .filter((line) => line.basis)
            .map((line) => {
              const basis = line.basis!
              return `${row.name} · ${line.name}：${exactAmount(basis.salesBase)} × ${(basis.salesRate * 100).toFixed(2)}% + ${exactAmount(basis.dailyAmount)}/天 × ${basis.days}天 = ${exactAmount(line.amount)}`
            }),
        ]),
    })
  }
  return items
}
