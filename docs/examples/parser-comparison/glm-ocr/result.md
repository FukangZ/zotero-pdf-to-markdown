<div style='text-align: center;'><img src='assets/EK3N4IGF-fig-001.png' alt='OCR图片'/></div>

<div align="center">

# Efficient and Precise Points-to Analysis: Modeling the Heap by Merging Equivalent Automata

</div>

Tian Tan $ ^{*} $ Yue Li $ ^{*} $ Jingling Xue

School of Computer Science and Engineering, UNSW, Australia

## Abstract

Mainstream points-to analysis techniques for object-oriented languages rely predominantly on the allocation-site abstraction to model heap objects. We present MAHJONG, a novel heap abstraction that is specifically developed to address the needs of an important class of type-dependent clients, such as call graph construction, devirtualization and mayfail casting. By merging equivalent automata representing type-consistent objects that are created by the allocation-site abstraction, MAHJONG enables an allocation-site-based points-to analysis to run significantly faster while achieving nearly the same precision for type-dependent clients.

MAHJONG is simple conceptually, efficient, and drops easily on any allocation-site-based points-to analysis. We demonstrate its effectiveness by discussing some insights on why it is a better alternative of the allocation-site abstraction for type-dependent clients and evaluating it extensively on 12 large real-world Java programs with five context-sensitive points-to analyses and three widely used type-dependent clients. MAHJONG is expected to provide significant benefits for many program analyses where call graphs are required.

CCS Concepts Theory of computation $ \rightarrow $ Program analysis

Keywords points-to analysis, heap abstraction

## 1. Introduction

Pointer Analyses should be designed to be appropriate in cost and precision for specific groups of client problems. We do not need a different pointer analysis per client problem, but rather we should look for classes of client problems with similar needs.

Barbara Ryder [17]

Every points-to analysis, especially for object-oriented languages such as Java and C#, requires a heap abstraction for partitioning the infinitely-sized heap into a finite number of (abstract) objects. For object-oriented programs, context-sensitivity is important for achieving useful precision. Due to many years of research, context-sensitivity can be achieved by three main approaches with different efficiency and precision tradeoffs: call-site-sensitivity [15, 22, 36, 42, 51, 53], object-sensitivity [29, 40, 48] and type-sensitivity [39].

However, little progress has been made on developing heap abstractions for points-to analysis. Mainstream pointsto analysis frameworks for Java, such as CHORD [10], DOOP [14], SOOT [49] and WALA [50], rely predominantly on the allocation-site abstraction to model heap objects. In this case, distinct allocation sites are represented by distinct (abstract) objects, with one object per site, which can be further separated context-sensitively in an orthogonal manner.

As programming languages become more heap-intensive the need for effective heap abstractions is greater [19, 38, 44]. The suitability of the allocation-site abstraction as a universal solution for all clients of points-to analysis needs to be revisited. While maximizing the precision for may-alias this abstraction often over-partitions the heap without improving the precision much for an important class of typedependent clients such as call graph construction, devirtualization and may-fail casting, causing often the underlying points-to analysis to be unscalable for large programs. For this reason, WALA [50] and DOOP [14], provide an option for all objects of a certain class, such as java.lang.String or java.lang.StringBuffer, to be merged ad hocly.

In this paper, we present MAHJONG, a novel heap abstraction that is specifically developed to address the needs of type-dependent clients. Given a program, we first create a lightweight alternative of the allocation-site abstraction by performing a fast but imprecise allocation-site-based points to analysis as a pre-analysis and then use it to drive a subsequent points-to analysis. Based on the points-to information found during the pre-analysis, MAHJONG merges two objects if both are type-consistent, i.e., if the objects reached from both along the same sequence of field accesses have a common type. We formulate the problem of checking the type-consistency of two objects as one of testing the equivalence of two sequential automata in almost linear time, by applying a classic Hopcroft-Karp algorithm [18] with minor

modifications. MAHJONG is simple conceptually and drops easily on any allocation-site-based points-to analysis.

Compared to the allocation-site abstraction, MAHJONG allows a points-to analysis to run significantly faster while achieving nearly the same precision for type-dependent clients. Thus, MAHJONG makes it possible to accelerate a given points-to analysis or replace it with a more precise but usually more costly points-to analysis that is either inefficient or unscalable if the allocation-site abstraction is used. MAHJONG is expected to provide significant benefits to many program analyses, such as bug detection, security analysis, program verification and program understanding, where call graphs are required [3, 5, 7, 16, 26, 31, 32, 43, 54, 55].

We demonstrate the effectiveness of MAHJONG by discussing some insights on why it is a better alternative of the allocation-site abstraction for type-dependent clients and conducting an evaluation extensively on 12 large Java programs with five widely used context-sensitive points-to analyses and three significant type-dependent clients, call graph construction, devirtualization and may-fail casting [20, 22, 39, 40, 42]. Take, 3obj, a 3-object-sensitive points-to analysis [29], the most precise one used in our evaluation, as an example. For the four programs that can be analyzed scalably under 3obj, our MAHJONG-based 3obj runs 131X faster, on average, while achieving nearly the same precision for all the three clients. For the remaining eight, where 3obj is unscalable in 5 hours each, our MAHJONG-based 3obj can analyze five of them in an average of 33.42 minutes.

In summary, our paper makes the following contributions:

- We present MAHJONG, a new heap abstraction that can significantly scale an allocation-site-based points-to analysis for object-oriented programs while achieving nearly the same precision for type-dependent clients.

- We formulate the problem of checking the type-consistency of two objects as one of testing the equivalence of two automata, which is solvable in almost linear time.

- We implement MAHJONG as a stand-alone open-source tool. MAHJONG is simple (with only 1500 LOC of Java in total) and drops easily on any allocation-site-based points-to analysis.

- We conduct extensive experiments to evaluate the effectiveness of MAHJONG in practice.

## 2. Motivation

For points-to analysis, type-dependent clients, such as call graph construction, devirtualization and may-fail casting, share similar needs: their precision depends on the types of pointed-to objects rather than the pointed-to objects themselves. For such clients, the conventional allocation-site abstraction is often too fine-grained, contributing little to improving their precision but rendering the underlying points-to analysis unduly inefficient or eventually unscal-

1 A x = new A(); // $ o_1^A $

2 A y = new A(); // $ o_2^A $

3 A z = new A(); // $ o_3^A $

4 x.f = new B(); // $ o_4^B $

5 y.f = new C(); // $ o_5^C $

6 z.f = new C(); // $ o_6^C $

7 A a = z.f;

8 a.foo();

9 C c = (C) a;

10 class A {

11 A f;

12 void foo() {...}

13 }

14 class B extends A {

15 void foo() {...}

16 }

17 class C extends A {

18 void foo() {...}

19 }

<div align="center">

Figure 1. An example program illustrating object merging.

</div>

able. In this paper, we aim to improve this by looking for a lightweight alternative that satisfies the needs of typedependent clients, but not necessarily others such as mayalias. To this end, we would like to avoid distinguishing two objects if merging them loses no or little precision.

In Section 2.1, we see that blindly merging objects of the same type is ineffective. In Section 2.2, we describe our solution that merges objects representing equivalent automata only. For object-oriented programs, merging objects amounts to merging their corresponding allocation sites.

## 2.1 Allocation-Type Abstraction: A Naive Solution

In this so-called allocation-type abstraction, all objects with the same type are merged, with one object per type. As previously noted, this naive solution often gains efficiency but may incur a significant loss of precision [19, 27, 38, 51].

Example 2.1. Consider Figure 1, where $ o_{i}^{t} $ represents the abstract object of type t created at the allocation site at line i. We will use this notation in the rest of the paper.

For the three type-dependent clients, call graph construction, devirtualization and may-fail casting, only lines 8-9 are relevant. According to an allocation-site-based Andersen's points-to analysis [4], x, y and z point to $ o_{1}^{A}, o_{2}^{A} $ and $ o_{3}^{A} $ , respectively. As x.f, y.f and z.f are not aliases, a points to $ o_{6}^{C} $ . Thus, a.foo() at line 8 is a mono-call and can thus be devirtualized, and in addition, the cast (C) at line 9 is safe.

However, if $ o_{1}^{A}, o_{2}^{A} $ and $ o_{3}^{A} $ are merged, then x.f, y.f and z.f will be aliases, causing a to also point to $ o_{4}^{B} $ . As a result, a.foo() becomes a poly-call and thus non-devirtualizable. In addition, the cast (C) is no longer considered safe.

Consider pmd, a program analyzed by (1) 3obj—a 3-object-sensitive points-to analysis [29] using the allocation-site abstraction, (2) T-3obj—3obj using the allocation-type abstraction, and (3) M-3obj—3obj using the MAHJONG heap abstraction introduced in this paper. For 3obj, pmd is analyzed in 14469.3 seconds, allowing 44004 call graph edges to be discovered. T-3obj is the fastest (50.3 seconds), but is the most imprecise (50666 call graph edges). In contrast, M-3obj is as precise as 3obj (44016 call graph edges) but is also nearly as fast as T-3obj (127.7 seconds).

<div style='text-align: center;'><img src='assets/EK3N4IGF-fig-002.png' alt='OCR图片'/></div>

<div align="center">

Figure 2. Field points-to graph rooted at $ o_{1}^{T} $ and $ o_{2}^{T} $

</div>

## 2.2 MAHJONG: Our Solution

To address the needs of type-dependent clients, MAHJONG is designed to maximally preserve the precision of the allocation-site abstraction while reaping the efficiency of the allocation-type abstraction as much as possible. For a given program, we first build a heap abstraction by performing a pre-analysis, i.e., a fast but imprecise allocation-site-based Andersen's points-to analysis [4] and then use it to guide a subsequent points-to analysis. Based on the pre-analysis, we define type-consistent objects that can be merged (Section 2.2.1) and formulate the problem of checking the typeconsistency of two objects as one of testing the equivalence of two automata in almost linear time (Section 2.2.2).

## 2.2.1 Defining Type-Consistent Objects

After the pre-analysis, the field points-to graph (FPG) is available, representing the points-to information for the object fields. To facilitate a subsequent reduction of the problem of checking type-consistency as one of testing the equivalence of automata, we introduce the field points-to graph rooted at an object o as $ \mathcal{G}_{o} = (\mathcal{H},\mathcal{F},\alpha,o,\mathcal{T},\tau). $ $ \mathcal{H} $ is the set of objects reachable from o. $ \mathcal{F} $ is the set of field names traversed along the way. The points-to relations for the object fields are defined by a field points-to map $ \alpha : \mathcal{H} \times \mathcal{F} \mapsto \mathcal{P}(\mathcal{H}). $ $ \mathcal{T} $ is the set of types of the objects in $ \mathcal{H} $ . The object-to-type map $ \tau : \mathcal{H} \mapsto \mathcal{T} $ reveals the type of an object.

Figure 2 gives the field points-to graphs rooted at $ o_{1}^{T} $ and $ o_{2}^{T} $ , by using the same notation for objects in Figure 1.

Example 2.2. Consider $ o_{2}^{T} $ first in Figure 2. $ \mathcal{G}_{o_{2}^{T}}=(\mathcal{H},\mathcal{F}, $ $ \alpha,o_{2}^{T},\mathcal{T},\tau). $ $ \mathcal{H}=\{o_{2}^{T},o_{4}^{U},o_{6}^{X},o_{8}^{Y}\}; $ $ \mathcal{F}=\{f,g,h,k\}; $ $ \alpha[o_{2}^{T},f]=\{o_{4}^{U}\}, $ $ \alpha[o_{4}^{U},h]=\{o_{8}^{Y}\}, $ $ \alpha[o_{2}^{T},g]=\{o_{6}^{X}\}, $ and $ \alpha[o_{6}^{X},k]=\{o_{8}^{Y}\}; $ $ \mathcal{T}=\{T,U,X,Y\}; $ and $ \tau[o_{2}^{T}]=T, $ $ \tau[o_{4}^{U}]=U, \tau[o_{6}^{X}]=X $ , and $ \tau[o_{8}^{Y}]=Y $ . Similarly, $ \mathcal{G}_{o_{1}^{T}} $ can be constructed.

Unlike the allocation-type abstraction, where all the objects with the same type are merged blindly, we will merge so-called type-consistent objects, thereby avoiding the imprecision introduced by the allocation-type abstraction.

Let $ \bar{f}=f_{1}.f_{2}.\dots.f_{n} $ , where n > 0, be a sequence of field names. For the field points-to graph $ \mathcal{G}_{o} $ rooted at an object o, we write $ pts(o.\bar{f}) $ to represent the set of objects that can be reached from o along any path of points-to edges labeled by $ f_{1}, f_{2}, \dots, f_{n} $ in $ \mathcal{G}_{o} $ in that order. In Figure 2, $ pts(o_{1}^{T}.f)=\{o_{3}^{U}\} $ and $ pts(o_{1}^{T}.f.h)=\{o_{7}^{Y},o_{9}^{Y}\}. $

Two objects with the same type are type-consistent if traversing from the two objects along the same sequence of field names always lead to objects of one single type.

Definition 2.1 (Type-Consistent Objects). Two objects, $ o_{i} $ and $ o_{j} $ , with the same type are said to be type-consistent denoted $ o_{i}\equiv o_{j} $ , if for every sequence of field names, $ \bar{f}=f_{1}.f_{2}.\dots f_{n} $ , the following two conditions hold:

$$
\begin{array}{l} 1. \left\{\tau [ o ] \mid o \in p t s \left(o _ {i}. \bar {f}\right) \right\} = \left\{\tau [ o ] \mid o \in p t s \left(o _ {j}. \bar {f}\right) \right\}, \text {a n d} \\ 2. \left| \left\{\tau [ o ] \mid o \in p t s \left(o _ {i}. \bar {f}\right) \right\} \right| = 1. \\ \end{array}
$$

In Figure 2, $ o_{1}^{T} $ and $ o_{2}^{T} $ are type-consistent. For the objects reached from $ o_{1}^{T} $ and $ o_{2}^{T} $ , along f, f.h, g and g.k, their sets of types are $ \{U\} $ , $ \{Y\} $ , $ \{X\} $ and $ \{Y\} $ , respectively.

We illustrate the intuition behind the notion of typeconsistency with an example discussed below.

Example 2.3. Let us return to Figure 1, for which the allocation-type abstraction will merge $ o_{1}^{A}, o_{2}^{A} $ and $ o_{3}^{A} $ (Section 2.1). By Definition 2.1, $ o_{2}^{A} $ and $ o_{3}^{A} $ are type-consistent (as $ o_{2}^{A}.f $ points to $ o_{5}^{C} $ and $ o_{3}^{A}.f $ points to $ o_{6}^{C} $ ) but $ o_{1}^{A} $ is not type-consistent with any (as $ o_{1}^{A}.f $ points to $ o_{4}^{B} $ ). After $ o_{2}^{A} $ and $ o_{3}^{A} $ are merged, y.f and z.f are regarded as aliases. Thus, a will point to not only $ o_{6}^{C} $ as before but also $ o_{5}^{C} $ spuriously. However, as $ o_{5}^{C} $ and $ o_{6}^{C} $ have the same type C, the precision of call graph construction and devirtualization at line 8 and may-fail casting at line 9 will not be affected.

Let us examine Definition 2.1. Condition 1 is self-explanatory in order to maximally preserve precision for type-dependent clients. What is the rationale behind Condition 2? The pre-analysis is fast but imprecise. Enforcing Condition 2 maximally avoids precision loss, as shown below.

<div style='text-align: center;'><img src='assets/EK3N4IGF-fig-003.png' alt='OCR图片'/></div>

<div align="center">

Figure 3. Illustrating Condition 2 in Definition 2.1.

</div>

Example 2.4. Suppose $ o_{i}^{T}.f $ and $ o_{j}^{T}.f $ point to both $ o_{1}^{X} $ and $ o_{2}^{Y} $ during the pre-analysis (Figure 3(a)) but $ o_{1}^{X} $ and $ o_{2}^{Y} $ respectively, in a more precise allocation-site-based pointsto analysis, $ \mathcal{A} $ (Figure 3(b)). If Condition 2 is ignored, $ o_{i}^{T} $ and $ o_{j}^{T} $ will become type-consistent according to the pre-analysis and thus merged into, say, $ o_{k}^{T} $ (represented by $ o_{i}^{T} $ or $ o_{j}^{T} $ ). Running $ \mathcal{A} $ with this new abstraction will result in precision loss, as $ o_{i}^{T}.f $ and $ o_{j}^{T}.f $ now point to objects of types X and Y (Figure 3(c)).

In Definition 2.1, the type-consistency relation $ \equiv $ is an equivalence relation. It is straightforward to verify that $ \equiv $ is reflexive, symmetric and transitive.

Let $ \mathbb{H} $ be the set of all abstract objects in the program.

<table border="1"><tr><td>Sequential Automata</td><td>Ao=(Q,Σ,δ,q0,Γ,γ)</td><td>$\Longleftrightarrow$</td><td>Go=(H,F,α,0,T&#x27;,τ)</td><td>o-Rooted Field Points-to Graph</td></tr><tr><td>A set of states</td><td>Q</td><td>$\longleftrightarrow$</td><td>H</td><td>A set of heap objects</td></tr><tr><td>A set of input symbols</td><td>Σ</td><td>$\longleftrightarrow$</td><td>F</td><td>A set of field identifiers</td></tr><tr><td>The next-state map:Q×Σ→P(Q)</td><td>δ</td><td>$\longleftrightarrow$</td><td>α</td><td>The field points-to map:H×F→P(H)</td></tr><tr><td>The initial state</td><td>q0</td><td>$\longleftrightarrow$</td><td>0</td><td>The object to be checked</td></tr><tr><td>A set of output symbols</td><td>Γ</td><td>$\longleftrightarrow$</td><td>T&#x27;</td><td>A set of types</td></tr><tr><td>The output map:Q→Γ</td><td>γ</td><td>$\longleftrightarrow$</td><td>τ</td><td>The object-to-type map:H→T&#x27;</td></tr></table>

<div align="center">

Figure 4. The mapping of a field points-to graph rooted at an object to a sequential automaton.

</div>

Definition 2.2 (MAHJONG's Heap Abstraction). Given the quotient set, $ \mathbb{H} / \equiv $ , MAHJONG will merge all the objects in the same equivalence class into one object.

Therefore, the key insight behind our new heap abstraction is not to distinguish two (container) objects of the same type if both containers store the objects of the same type at all their corresponding nested sub-containers.

How do we check the type-consistency of two objects efficiently, especially for large programs with a large number of heap objects, field names and class types? Enumerating all the possible field access paths $ \bar{f} $ as required in Definition 2.1, especially in the presence of cycles, may be exponential in terms of the number of edges traversed [28, 34], causing the pre-analysis to be too inefficient or even unscalable. We describe a fast and elegant solution below.

## 2.2.2 Merging Equivalent Automata

We transform the problem of checking the type-consistency of two objects into one of testing the equivalence of two automata. Figure 4 relates the field points-to graph rooted at an object o, $ \mathcal{G}_{o}=(\mathcal{H},\mathcal{F},\alpha,o,\mathcal{T},\tau) $ , to a 6-tuple sequential automaton $ \mathcal{A}_{o}=\left(Q,\Sigma,\delta,q_{o},\Gamma,\gamma\right) $ [1], which is more general than a traditional (5-tuple) automaton. In fact, a 5-tuple automaton can be turned into a 6-tuple automaton, if its accepting (acc) and non-accepting (non-acc) states are distinguished by $ \gamma:Q\mapsto\Gamma $ , where $ \Gamma=\{ \mathrm{a c c}, \mathrm{n o n - a c c} \} $

Example 2.5. Continuing from Example 2.2 (Figure 2), the automaton $ \mathcal{A}_{o_{2}^{T}} $ for $ \mathcal{G}_{o_{2}^{T}}=(\mathcal{H},\mathcal{F},\alpha,o_{2}^{T},\mathcal{T},\tau) $ is obtained according to Figure 4. Similarly, $ \mathcal{A}_{o_{1}^{T}} $ is constructed.

The behavior of $ \mathcal{A}_{o} $ , which can be an NFA (consisting of multiple edges with the same label leaving a state), is:

$$
\beta_ {\mathcal {A} _ {o}}: \Sigma^ {*} \rightarrow \mathcal {P} (\Gamma)
$$

If $ \mathcal{A}_{o} $ finally reaches the states, $ s_{1}, s_{2}, \dots , s_{n} $ , after having read an input w in $ \Sigma^{*} $ , then $ \beta_{\mathcal{A}_{o}}(w)=\cup_{i=1}^{n}\gamma[s_{i}]. $

Let $ o_{1}^{T} $ and $ o_{2}^{T} $ be two objects with the same type $ T $ . Let their automata $ \mathcal{A}_{o_{1}^{T}} $ and $ \mathcal{A}_{o_{2}^{T}} $ be built as shown in Figure 4. $ o_{1}^{T} $ and $ o_{2}^{T} $ are type-consistent if, for every input w in $ \Sigma^{*} $ , (1) $ \beta_{\mathcal{A}_{o_{1}^{T}}}(w)=\beta_{\mathcal{A}_{o_{2}^{T}}}(w) $ (Condition 1 of Definition 2.1) and (2) $ |\beta_{\mathcal{A}_{o_{1}^{T}}}(w)|=1 $ (Condition 2 of Definition 2.1).

Therefore, we have reduced the problem of checking the type-consistency of $ o_{1}^{T} $ and $ o_{2}^{T} $ to one of testing the equivalence of their corresponding automata $ \mathcal{A}_{o_{1}^{T}} $ and $ \mathcal{A}_{o_{2}^{T}} $ , which is solvable by the Hopcroft-Karp algorithm [18] with minor modifications. The worst-case time complexity is $ O(|\Sigma| \times|Q_{\mathrm{larger}}|) $ , which is almost linear in terms of $ |Q_{\mathrm{larger}}| $ , where $ Q_{\mathrm{larger}} $ is the set of states of the larger automaton [18].

Example 2.6. Continuing from Example 2.5, we see easily that $ o_{1}^{T} $ and $ o_{2}^{T} $ are type-consistent (Figure 2) since their corresponding automata $ \mathcal{A}_{o_{1}^{T}} $ and $ \mathcal{A}_{o_{2}^{T}} $ are equivalent.

## 3. MAHJONG

We first give an overview of MAHJONG that consists of four components (Section 3.1). We then describe each component in detail (Sections 3.2-3.5). Finally, we discuss MAHJONGbased points-to analysis (Section 3.6).

## 3.1 Overview

As shown in Figure 5, MAHJONG takes the field points-to graph (FPG) computed by a pre-analysis (Section 2.2.1) as input and builds a heap abstraction (Definition 2.2) to be used by a subsequent points-to analysis. The pre-analysis is fast but imprecise, by using Andersen's algorithm [4] with the allocation-site abstraction, context-insensitively. The subsequent points-to analysis will be more precise, usually performed context-sensitively, especially for object-oriented programs, based on the MAHJONG heap abstraction.

MAHJONG iteratively picks a pair of objects $ o_{i}^{T} $ and $ o_{j}^{T} $ with the same type T and merges them if they are type-consistent, until no such pair can be found. Given $ o_{i}^{T} $ and $ o_{j}^{T} $ their corresponding NFAs, $ NFA_{o_{i}^{T}} $ and $ NFA_{o_{j}^{T}} $ , are first built by using the NFA Builder. Then the two NFAs are converted into their equivalent DFAs, $ DFA_{o_{i}^{T}} $ and $ DFA_{o_{j}^{T}} $ , by using the DFA Converter. Next, the Automata Equivalence Checker determines whether $ DFA_{o_{i}^{T}} $ and $ DFA_{o_{j}^{T}} $ are equivalent or not Finally, the Heap Modeler outputs a new heap abstraction.

The detailed algorithms are given in Section 4.

## 3.2 The NFA Builder

The NFA builder takes an object o, with the field points-to graph $ \mathcal{G}_{o} $ rooted at o, and constructs a 6-tuple NFA $ \mathcal{A}_{o}= $

<div style='text-align: center;'><img src='assets/EK3N4IGF-fig-004.png' alt='OCR图片'/></div>

<div align="center">

Figure 5. Overview of MAHJONG.

</div>

($ Q, \Sigma, \delta, q_{0}, \Gamma, \gamma $ ) according to the mapping, as shown in Figure 4. In fact, $ \mathcal{A}_{o} $ can be immediately read off from $ \mathcal{G}_{o}. $

## 3.3 The DFA Converter

The DFA Converter converts an NFA to an equivalent DFA based on the subset construction algorithm [2] with minor modifications. The resulting DFA is still a 6-tuple sequential automaton except that it is deterministic.

## 3.4 The Automata Equivalence Checker

The Automata Equivalence Checker tests the equivalence of two DFAs by applying a classic Hopcroft-Karp algorithm [18] with minor modifications in almost linear time.

## 3.5 The Heap Modeler

After all type-consistent objects have been found, the type-consistency equivalence relation $ \equiv $ given in Definition 2.1 becomes fully constructed. By Definition 2.2, the new heap abstraction found is simply given by $ \mathbb{H} / \equiv $ . For every equivalent class $ [o_{i}^{T}] \in \mathbb{H} / \equiv $ , a representative object $ o_{j}^{T} $ is arbitrarily picked to substitute for the other objects in the class. Essentially, the allocation sites for all objects in $ [o_{i}^{T}] $ are merged and represented by the allocation site of $ o_{j}^{T} $ only.

To enable a points-to analysis to use our new heap abstraction, we only need to change its rule for handling allocation sites. Given i : x = new T() in a Java program, where $ o_{j}^{T} $ is a representative for $ [ o_{i}^{T} ] $ , x is made to point to $ o_{j}^{T}. $

## 3.6 MAHJONG-based Points-To Analysis

Let $ \mathcal{A} $ be an allocation-site-based points-to analysis, which is either call-site-sensitive [15, 22, 36, 42, 51], object-sensitive [29, 40, 48] or type-sensitive [39]. We first discuss how to obtain M-A $ \mathcal{A} $ , a MAHJONG-based points-to analysis, from $ \mathcal{A} $ (Section 3.6.1). We then discuss briefly the soundness and precision of M-A relative to $ \mathcal{A} $ for type-dependent clients.

## 3.6.1 Obtaining M- $ \mathcal{A} $ from $ \mathcal{A} $

In a context-sensitive points-to analysis, local variables are analyzed context-sensitively by distinguishing the calling contexts for a method. Heap objects are modeled context-sensitively by distinguishing the calling contexts for allocation sites. Different context-sensitivity are distinguished by different kinds of context elements used, as discussed below.

We obtain M-A from $ \mathcal{A} $ by first replacing $ \mathcal{A} $ 's allocation-site abstraction with the MAHJONG heap abstraction. We then need to make minor modifications to $ \mathcal{A} $ to enable M-A to handle merged objects effectively.

Regardless of whether $ \mathcal{A} $ is call-site-, object- or typesensitive, M- $ \mathcal{A} $ will always model a merged object o contextinsensitively. There would be otherwise of little benefit in modeling o context-sensitively, since the objects accessed by $ o.f_{1}.f_{2}.\dots.f_{n} $ for any $ f_{1}.f_{2}.\dots.f_{n} $ under different contexts are expected to have the same type, in practice. Below we discuss how the calling contexts for methods are modified, if needed, when they are related to merged objects.

Call-Site-Sensitivity A k-call-site-sensitive points-to analysis, i.e., a k-CFA [37] separates information on local variables per call-stack (i.e., sequence of k call-sites) of method invocations that lead to the current method. By convention, a sequence of k-1 call-sites is used as a calling context for an allocation site [20, 39, 48].

If $ \mathcal{A} $ is k-call-site-sensitive [37], then M- $ \mathcal{A} $ behaves identically as $ \mathcal{A} $ in handling methods. For the reason mentioned above, M- $ \mathcal{A} $ models the merged objects context-insensitively but everything else context-sensitively as in $ \mathcal{A} $

Object-Sensitivity $ k $ - object-sensitivity is similar to $ k $ - callsite-sensitivity except that allocation sites rather than call sites are used as context elements [29]. Let $ o_{i} $ be an abstract object identified by its allocation site $ i $ . In $ k $ - object-sensitivity, the object $ o_{i} $ at allocation site $ i $ is modeled context-sensitively by a calling context $ [o_{i_{k-1}},\dots,o_{i_{1}}] $ (of length $ k-1 $ ), where $ i_{j} $ is the allocation site for the receiver object $ o_{i_{j}} $ of the method that contains $ i_{j-1} $ (with $ i_{0}=i $ ). If $ x $ points to an object $ o_{i} $ modeled under a context $ [o_{i_{k-1}},\dots,o_{i_{1}}] $ , then the $ k $ - object-sensitive calling context used for analyzing a callee of a method call $ x.foo() $ is $ [o_{i_{k-1}},\dots,o_{i_{1}},o_{i}] $ .

If $ \mathcal{A} $ is a k-object-sensitive points-to analysis, M- $ \mathcal{A} $ models merged objects context-insensitively, i.e., object-insensitively but everything else objective-sensitively as in $ \mathcal{A} $ . As a result, calling contexts that contain merged objects

as context elements are modified accordingly. For an object o that is used in a calling context under $ \mathcal{A} $ , o is replaced by a representative of $ [o]\in \mathbb{H}/\equiv $ (Section 3.5) under M- $ \mathcal{A} $ In other words, if o is merged with some type-consistent objects, then its representative is used, instead.

Type-Sensitivity To trade precision for efficiency, $k$-type-sensitivity is derived from $k$-object-sensitivity by replacing every object in a calling context with the class type that contains the corresponding allocation site for the object [39].

If $ \mathcal{A} $ is a $ k $ -type-sensitive analysis obtained from its corresponding $ k $ -object-sensitive analysis $ \mathcal{A}^{\prime} $ , then $ M $ - $ \mathcal{A} $ is simply obtained from $ M $ - $ \mathcal{A}^{\prime} $ in the same type-sensitive manner.

## 3.6.2 Soundness and Precision of $ M $ - $ \mathcal{A} $ over $ \mathcal{A} $

The soundness of M- $ \mathcal{A} $ is easy to establish. If $ \mathcal{A} $ is sound, then M- $ \mathcal{A} $ is sound as the MAHJONG heap abstraction is coarser than the allocation-site abstraction used in $ \mathcal{A} $ .

We discuss some insights below on why merging type-consistent objects enables M- $ \mathcal{A} $ to maximally preserve the precision of $ \mathcal{A} $ for type-dependent clients. This is true for all three types of context-sensitivity as validated later.

We first describe a rarely occurring subtle case, the nullfield problem, illustrated in Figure 6, due to the imprecision of the pre-analysis, causing precision loss for all the three types of MAHJONG-based context-sensitivity.

Example 3.1. Suppose $ o_{i}^{T}.f $ and $ o_{j}^{T}.f $ both point to $ o_{1}^{X} $ during the pre-analysis (Figure 6(a)) but $ o_{1}^{X} $ and null, respectively, in $ \mathcal{A} $ (Figure 6(b)). In M- $ \mathcal{A} $ , $ o_{i}^{T} $ and $ o_{j}^{T} $ are type-consistent and thus merged into $ o_{k}^{T} $ (represented by either $ o_{i}^{T} $ or $ o_{j}^{T} $ ), M- $ \mathcal{A} $ is less precise, as $ o_{j}^{T}.f $ , which points to null in $ \mathcal{A} $ , now points to an object of type X (Figure 6(c)).

<div style='text-align: center;'><img src='assets/EK3N4IGF-fig-005.png' alt='OCR图片'/></div>

<div align="center">

Figure 6. Illustrating the null-field problem.

</div>

If $ \mathcal{A} $ is call-site-sensitive, $ M-\mathcal{A} $ is as precise as $ \mathcal{A} $ for a type-dependent client if the null-field problem never occurs in a program analyzed by $ \mathcal{A} $ . Recall that the pre-analysis is no more precise than $ \mathcal{A} $ . By Definition 2.1, the objects reached from o along the same sequence of field accesses must have exactly the same type when o is modeled both context-sensitively under $ \mathcal{A} $ and context-insensitively under $ M-\mathcal{A} $ , resulting in the same precision in both cases. In general, $ M-\mathcal{A} $ is no more precise than $ \mathcal{A} $ due to the null-field problem but very close to $ \mathcal{A} $ as the null-fields are rare.

If $ \mathcal{A} $ is object-sensitive, then $ M-\mathcal{A} $ is no more precise than $ \mathcal{A} $ for type-dependent clients, as some heap objects that are used in distinguishing different contexts in $ \mathcal{A} $ are merged by MAHJONG if they are type-consistent. However, this hardly

hurts the precision, making M-A nearly as precise as A for type-dependent clients, in practice. The key insight behind object-sensitivity [29] is to distinguish the side-effects of different receiver objects of an instance method foo() by analyzing it under multiple calling contexts, one per receiver object. By merging a set of type-consistent receiver objects for foo(), we end up achieving a significant performance benefit at little precision loss by analyzing foo() under the same context by M-A rather than separately but unnecessarily by A for these receiver objects. For type-dependent clients, this represents a generalization of object-sensitivity.

If $ \mathcal{A} $ is type-sensitive, then M-A is nearly as precise as (sometimes slightly better or worse than) $ \mathcal{A} $ for type-dependent clients, in practice. Consider an equivalence class $ [o]=\{o_{1},\ldots,o_{n}\}\in \mathbb{H}/\equiv $ (Definition 2.2) formed by the MAHJONG heap abstraction. In $ \mathcal{A} $ , every $ o_{i} $ that is used as a context element in a calling context is replaced by the class type that contains the allocation site for $ o_{i} $ . In M-A, $ o_{1},\ldots,o_{n} $ are merged and replaced by the class type that contains the allocation site for a representative in $ [o] $ . Thus, the MAHJONG heap abstraction can be coarser than the allocation-site abstraction for some methods and finer for some others in partitioning their calling contexts, which depends on the representatives chosen.

<div style='text-align: center;'><img src='assets/EK3N4IGF-fig-006.png' alt='OCR图片'/></div>

<div align="center">

Figure 7. Precision of M-ktype over ktype.

</div>

Let us see how the choice of representative for an equivalence class affects the precision of M-ktype.

Example 3.2. In Figure 7, ktype (k-type-sensitive analysis) will represent the allocation sites 1 and 2 by T. Thus, the two allocation sites that are distinguished by kobj (k-object-sensitive analysis) are merged. According to MAHJONG, $ o_{1}^{A} $ and $ o_{3}^{A} $ are type-consistent, falling into the same equivalence class. If $ o_{3}^{A} $ happens to be selected as a representative, then M-ktype will be able to distinguish the allocation sites 1 and 2 by U and T, respectively. However, if $ o_{1}^{A} $ is selected as the representative (not shown in Figure 7), then M-ktype will merge the allocation sites 1, 2 and 3 by using T as the context, and become less precise than ktype.

However, the choice of representative for an equivalence class $ [o]=\{o_{1},\ldots,o_{n}\}\in \mathbb{H}/\equiv $ does not affect the soundness of M-ktype. Regardless of what object is selected, replacing $ o_{i} $ in a context used in the corresponding kobj by the containing type of a representative in $ [o] $ in M-ktype always yields a context abstraction that is either identical or coarser, by the definition of type-sensitivity [39].

## 4. Algorithms

We present the algorithms used in MAHJONG. In Section 4.1, we give some domains used and then the main algorithm. In Sections 4.2-4.5, we describe the algorithms of its four components introduced in Sections 3.2-3.5.

## 4.1 MAHJONG

For a program, we use the three domains: (1) $ \mathbb{H} $ is the set of all abstract heap objects (i.e., allocation sites), (2) $ \mathbb{F} $ is the set of all field names, and (3) $ \mathbb{T} $ is the set of all types. Note that we have used $ \mathbb{H} $ earlier in Definition 2.2.

Now, we can formally define the input and output of MAHJONG. MAHJONG takes a field points-to graph, FPG = (N, E), which is a directed weighted graph, as input. A node $ o_{i}\in \mathbb{N}=\mathbb{H} $ represents a heap object in the program. An edge $ (o_{i},f,o_{j})\in \mathsf{E}\subseteq \mathbb{N}\times \mathbb{F}\times \mathbb{N} $ indicates that $ o_{i}.f $ points to $ o_{j} $ . We assume that the FPG contains a dummy node $ o_{\mathrm{null}} $ to represent null. If $ o_{i}.f=\mathrm{null} $ , then $ (o_{i},f,o_{\mathrm{null}})\in \mathsf{E} $ . We also assume $ (o_{\mathrm{null}},f,o_{\mathrm{null}})\in \mathsf{E} $ for every field $ f\in \mathbb{F}. $

The output of MAHJONG is a new heap abstraction, represented by a merged object map, MOM $ \subseteq $ $ \mathbb{H} $ $ \rightarrow $ $ \mathbb{H} $ , which relates an object in an equivalence class in $ \mathbb{H} $ $ / $ $ \equiv $ to its representative object (as described in Section 3.5).

Algorithm 1: MAHJONG

Input : FPG (Field Points-to Graph)

Output: MOM (Merged Object Map)

1 Let $W$ be a new set

2 foreach $o \in \mathbb{H}$ do

3 Add {o} to $W$

4 foreach $o_i, o_j \in \mathbb{H}$ s.t. $W.\mathrm{FIND}(o_i) \neq W.\mathrm{FIND}(o_j)$ do

5 if TYPEOF($o_i$) == TYPEOF($o_j$) and

6 SINGLETYPE-CHECK($o_i$, FPG) and

7 SINGLETYPE-CHECK($o_j$, FPG) then

8 $NFAo_i = \mathrm{NFA-BUILDER}(o_i$, FPG)

9 $NFAo_j = \mathrm{NFA-BUILDER}(o_j$, FPG)

10 $DFAo_i = \mathrm{DFA-CONVERTER}(NFAo_i)$

11 $DFAo_j = \mathrm{DFA-CONVERTER}(NFAo_j)$

12 if EQUIV-CHECKER($DFAo_i, DFAo_j$) then

13 $W.\mathrm{UNION}(o_i, o_j)$

14 Let MOM be a new map

15 foreach $o \in \mathbb{H}$ do

16 $MOM[o] = W.\mathrm{FIND}(o)$

17 return MOM

Algorithm 1 gives the main algorithm. To facilitate merging type-consistent objects, we make use of the concept of disjoint sets [11]. In a set S of disjoint sets, each disjoint set is identified by a representative, which is some member of the disjoint set. We make use of two classic operations over disjoint sets, UNION and FIND. S.UNION(x, y) unites the disjoint sets in S that contain x and y, say $ S_{x} $ and $ S_{y} $ , into a new disjoint set that is the union of the two, adds it to S, and destroys $ S_{x} $ and $ S_{y} $ in S. The representative of the re-

$$
S _ {x} \cup S _ {y}. S. \mathrm {F I N D} (x)
$$

MAHJONG first initializes W by adding to it a singleton set for each object (lines 1-3). Then it iterates over every pair of objects, $ o_{i} $ and $ o_{j} $ in $ \mathbb{H} $ , that are not yet merged, and merges the pair if both are type-consistent (lines 4-13). According to line 5, $ o_{i} $ and $ o_{j} $ are mergeable only if both have the same type. The function TYPEOF : $ \mathbb{H} \rightarrow \mathbb{T} $ returns the type of a given object and a special type for $ o_{\mathrm{null}}. $

To check the type consistency of $ o_{i} $ and $ o_{j} $ by Definition 2.1 efficiently, we handle its two conditions separately, with Condition 2 in lines 6-7 and Condition 1 in lines 8 12. In lines 6-7, the function SINGLETYPE-CHECK : $ \mathbb{H}\times \mathrm{FPG}\rightarrow \{\mathrm{TRUE},\mathrm{FALSE}\} $ is applied to see if Condition 2 holds for both $ o_{i} $ and $ o_{j} $ . If so, MAHJONG then proceeds to build the NFAs for the two objects (Section 4.2), convert the NFAs to their equivalent DFAs (Section 4.3), and finally, test their equivalence (Section 4.4). If the two DFAs are equivalent, then MAHJONG calls W.UNION( $ o_{i},o_{j} $ ) to merge $ o_{i} $ and $ o_{j} $ at line 13. Finally, in lines 14-16, MAHJONG builds a new heap abstraction as desired (Section 4.5).

Given an object o, Algorithm 2 (NFA-BUILDER) builds an NFA, $ \mathcal{A}_{o}=(Q,\Sigma,\delta,q_{0},\Gamma,\gamma) $ , according to the mapping from the field points-to graph rooted at o to $ \mathcal{A}_{o} $ in Figure 4.

## 4.2 The NFA Builder

Algorithm 2: NFA-BUILDER

Input : $ \circ $ (Input object)

FPG = (N, E) (Field Points-to Graph)

Output: $ \mathrm{NFA}=\left(Q,\Sigma,\delta,q_{0},\Gamma,\gamma\right) $

1 $ q_{0}=\circ $

2 Let $ Q $ be a set of objects reachable from $ \circ $ in FPG

3 Let $ \Sigma $ and $ \Gamma $ be two new sets

4 Let $ \gamma $ and $ \delta $ be two new maps

5 foreach $ o_{i}\in Q $ do

6 $ \left\{\begin{array}{l} \Sigma=\Sigma\cup\mathrm{FIELDSOF}(o_{i}) \\ \Gamma=\Gamma\cup\left\{\mathrm{TYPEOF}(o_{i})\right\} \\ \gamma[o_{i}]\mathrm{=TYPEOF}(o_{i}) \end{array}\right. $

7

8

9 foreach $ \left(o_{i},f,o_{j}\right)\in E $ do

10 if $ o_{i}\in Q $ then

11 Add $ o_{j} $ to $ \delta[o_{i},f] $

12 return $ \mathrm{NFA}=\left(Q,\Sigma,\delta,q_{0},\Gamma,\gamma\right) $

NFA-BUILDER constructs all the six components for $ \mathcal{A}_{o} $ Its initial state $ q_{0} $ is simply o (line 1). Q is the set of objects reachable from o in FPG (line 2). The objects in Q are iterated over to build $ \Sigma $ (set of input symbols), $ \Gamma $ (set of output symbols), and $ \gamma $ (output map) at lines 5-8. The function FIELDSOF : $ \mathbb{H}\rightarrow \mathcal{P}(\mathbb{F}) $ returns the fields of a given object. Finally, the relevant edges in FPG are traversed to build the state transition map $ \delta $ (lines 9-11).

## 4.3 The DFA Converter

Algorithm 3 (DFA-CONVERTER) converts an NFA to its equivalent DFA by using the subset construction [2].

There are three minor differences. First, we do not need to handle (non-existent) $ \epsilon $ -transitions. Second, we can find the next states of a DFA state q more efficiently. In the general case, all input symbols must be examined. In our case (lines 7-9), we only need to iterate over the fields (input symbols) of an arbitrarily picked object (an NFA state) in q to find its next states. Due to SINGLETYPE-CHECK in lines 6-7 of Algorithm 1, the objects grouped in a DFA state q must have the same type. Finally, we need to compute $ \Gamma^{\prime} $ (set of output symbols) and $ \gamma^{\prime} $ (output map) at lines 14-16,

Algorithm 3: DFA-CONVERTER

Input : NFA = (Q, $ \Sigma $ , $ \delta $ , $ q_{0} $ , $ \Gamma $ , $ \gamma $ )

Output: DFA = ( $ Q^{\prime} $ , $ \Sigma^{\prime} $ , $ \delta^{\prime} $ , $ q_{0}^{\prime} $ , $ \Gamma^{\prime} $ , $ \gamma^{\prime} $ )

$ q_{0}^{\prime} $ = { $ q_{0} $ }

$ \Sigma^{\prime} $ = $ \Sigma $

Let $ Q^{\prime} $ and $ \Gamma^{\prime} $ be two new sets

Let $ \delta^{\prime} $ and $ \gamma^{\prime} $ be two new maps

Add $ q_{0}^{\prime} $ as an unmarked state to $ Q^{\prime} $

while there is an unmarked state $ q \in Q^{\prime} $ do

Mark $ q $

Pick any $ o_{i} $ from $ q $

foreach $ f \in $ FIELDSOF( $ o_{i} $ ) do

$ q^{\prime} $ = { $ \delta[o_{j}, f] $ | $ o_{j} \in q $ }

if $ q^{\prime} $ $ \notin $ $ Q^{\prime} $ then

Add $ q^{\prime} $ as an unmarked state to $ Q^{\prime} $

$ \delta^{\prime}[q, f] $ = $ q^{\prime} $

foreach $ q \in Q^{\prime} $ do

$ \gamma^{\prime}[q] $ = { $ \mathrm{TYPEOF}(o_{i}) $ | $ o_{i} \in q $ }

$ \Gamma^{\prime} $ = $ \Gamma^{\prime} $ $ \cup $ $ \gamma^{\prime}[q] $

return DFA = ( $ Q^{\prime} $ , $ \Sigma^{\prime} $ , $ \delta^{\prime} $ , $ q_{0}^{\prime} $ , $ \Gamma^{\prime} $ , $ \gamma^{\prime} $ )

Algorithm 4 (EQUIV-CHECKER) tests the equivalence of two 6-tuple DFAs, by applying a Hopcroft-Karp algorithm that was proposed for two 5-tuple DFAs [18] with minor modifications at line 19 on testing whether all states in $ s\in V $ have the same type. As discussed in Section 2.2.2, a 5-tuple DFA can be modeled as a special case of a 6-tuple DFA.

## 4.4 The Automata Equivalence Checker

EQUIV-CHECKER iterates over all fields $ f\in\Sigma $ (line 14) and queries the transition map $ \delta $ to obtain the next states (line 15). By convention, if $ \delta[q,f] $ is not defined, since the objects in q do not have the field f, we assume that $ \delta[q,f] = q_{\mathrm{error}}. $ In addition, $ \gamma[q_{\mathrm{error}}] $ returns a special type for $ q_{\mathrm{error}}. $

## 4.5 The Heap Modeler

After Algorithm 1 has terminated, we have $ W=\mathbb{H}/\equiv $ in its line 16. Then MOM specifies the new heap abstraction given in Definition 2.2, as discussed in Section 3.5.

## 5. Implementation

We have implemented MAHJONG as a standalone tool in a total of only 1500 LOC in Java to build a new heap abstraction by merging equivalent automata. MAHJONG is designed

Algorithm 4: EQUIV-CHECKER

Input : $ \mathrm{DFA}_{1}=\left(Q_{1},\Sigma_{1},\delta_{1},q_{1},\Gamma_{1},\gamma_{1}\right) $

$ \mathrm{DFA}_{2}=\left(Q_{2},\Sigma_{2},\delta_{2},q_{2},\Gamma_{2},\gamma_{2}\right) $

Output: TRUE or FALSE (Are $ \mathrm{DFA}_{1} $ and $ \mathrm{DFA}_{2} $ equivalent?)

$ Q=Q_{1}\cup Q_{2} $

$ \Sigma=\Sigma_{1}\cup\Sigma_{2} $

$ \delta[q,f]=\left\{\begin{array}{ll}\delta_{1}[q,f]&\mathrm{if} q\in Q_{1}\\ \delta_{2}[q,f]&\mathrm{if} q\in Q_{2}\end{array}\right. $

$ \Gamma=\Gamma_{1}\cup\Gamma_{2} $

$ \gamma[q]=\left\{\begin{array}{ll}\gamma_{1}[q]&\mathrm{if} q\in Q_{1}\\ \gamma_{2}[q]&\mathrm{if} q\in Q_{2}\end{array}\right. $

$ \mathrm{DFA}=\left(Q,\Sigma,\delta,q_{1},\Gamma,\gamma\right) $

Let $ V $ be a new set

foreach $ q\in Q $ do

Add $ \{q\} $ to $ V $

$ V.\mathrm{UNION}(q_{1},q_{2}) $

Push $ \left(q_{1},q_{2}\right) $ to a new stack, STACK

while STACK is not empty do

Pop $ \left(p_{1},p_{2}\right) $ from STACK

foreach $ f\in\Sigma $ do

$ r_{1}=\mathrm{V.FIND}(\delta\left[p_{1},f\right]),r_{2}=\mathrm{V.FIND}(\delta\left[p_{2},f\right]) $

if $ r_{1}\neq r_{2} $ then

$ \mathrm{V.UNION}(r_{1},r_{2}) $

Push $ \left(r_{1},r_{2}\right) $ to STACK

return {TRUE if $ \forall s\in V:\forall p,q\in s:\gamma[p]=\gamma[q] $ FALSE otherwise

to work with mainstream allocation-site-based points-to analysis frameworks such as CHORD [10], WALA [50], SOOT [49] and DOOP [14]. To demonstrate its effectiveness, we have integrated MAHJONG with DOOP [9, 14], a state-of-the-art whole-program points-to analysis framework for Java. MAHJONG is released as an open-source tool at http://www.cse.unsw.edu.au/~corg/mahjong. Below we discuss three major optimizations.

Disjoint-Set Forest In Algorithms 1 and 4, disjoint sets are used. For efficiency, we have implemented a set of disjoint sets as a disjoint-set forest, by representing each disjoint set as a tree with its root being its representative. Thus, UNION amounts to linking the roots of different trees while FIND returns the root of a tree. To improve the efficiency further, we have also implemented two heuristics, union by rank and path compression [11]. As a result, the average execution time of each UNION/FIND operation over a disjoint-set forest can be reduced to nearly O(1) [11].

Shared Sequential Automata In Algorithms 2 and 3,new automata are frequently created. However, different automata can be partly identical, since their common parts correspond to the same objects. Instead of always creating new automata, we allow different automata to share their common parts. This optimization reduces significantly both the time and space costs of the overall algorithm.

Parallel Type-Consistency Checks A synchronizationfree parallelization scheme is used. This is achieved by requiring different threads to merge objects of different types (with every thread executing lines 6-13 of Algorithm 1). To avoid synchronizations, object merging takes place only at line 13 of Algorithm 1, and in addition, all shared automata are constructed beforehand and concurrently read only.

## 6. Evaluation

We show that MAHJONG is effective in significantly scaling context-sensitive points-to analyses for large Java programs while achieving nearly the same precision for typedependent clients. We address two major research questions:

RQ1. Is MAHJONG effective as a pre-analysis?

(a) Is MAHJONG lightweight for large programs?

(b) Can MAHJONG avoid the allocation-site abstraction's heap over-partitioning for type-dependent clients?

RQ2. Is MAHJONG-based points-to analysis effective?

(a) Can MAHJONG accelerate different types of mainstream context-sensitive points-to analyses?

(b) Can MAHJONG achieve comparable precision as the allocation-site abstraction for type-dependent clients?

Type-Dependent Clients We consider three representative type-dependent clients, call graph construction, devirtualization and may-fail casting, provided by DOOP [14].

Context-Sensitive Points-to Analyses We consider five context-sensitive points-to analyses also from DOOP as baselines. These cover the three main types of mainstream context-sensitivity: call-site-sensitivity [15, 22, 36, 42, 51], object-sensitivity [29, 40, 48] and type-sensitivity [39]. We also provide experimental evidence on why context-insensitivity is inadequate for type-dependent clients.

Benchmarks We consider 12 large Java programs including 3 popular applications findbugs, checkstyle and JPC and all standard DaCapo benchmarks [12] except jython and hsq1db as they are not scalable under 3 out of the 5 baseline analyses with and without MAHJONG. These programs are all analyzed with a large Java library JDK1.6.0_45.

As a static reflection analysis may affect the efficiency and precision of points-to analysis [24, 25, 38], we adopt the same resolution results generated by a dynamic reflection analysis tool, TAMIFLEX [8], in both the five baselines and their corresponding MAHJONG-based points-to analyses.

Computing Platform We have done our experiments on a Xeon E5-1620 3.7GHz machine with 128GB of RAM. The analysis time of a program is the average of 3 runs.

Pre-Analysis For this, we use the fast context-insensitive points-to analysis, denoted ci, provided by DOOP [14]. Different pair-wise type-consistency tests are performed in parallel, as discussed in Section 5, with 8 threads on 4 cores.

Table 2 presents the main results, which will be analyzed when our research questions are discussed below. For a program, we consider the abstract objects reachable from main() in both the application and library code.

## 6.1 RQ1: MAHJONG's Effectiveness as a Pre-Analysis

## 6.1.1 Efficiency

The overall pre-analysis phase is fast, as shown in Column 2 of Table 2. For a program, its analysis time is broken down into three components, taken by ci (the context-insensitive points-to analysis), FPG (a module for building its FPG), MAHJONG (for creating a new heap abstraction). For all the 12 programs, the average analysis time for ci is 62.3 seconds. The runtime overheads for the other two are negligible.

The efficiency of MAHJONG cannot be over-emphasized, as it could not otherwise be used as an enabling technology for a subsequent points-to analysis. On average, a FPG consists of 10073 objects of 1559 types with 2411 fields. MAHJONG builds an NFA for each object in the FPG, with its size measured in terms of its number of states. The average sizes of NFAs range from 356 in luindex to 3789 in eclipse, with an average of 992. For each program, the smallest NFA always has one state only. Across all the programs, the sizes of their largest NFAs range from 1935 in luindex to 10034 in eclipse. This costs MAHJONG only an average of 3.8 seconds for each program. Such good performance is due to both our design (by merging objects in terms of merging equivalent automata) and several effective optimizations performed (see Section 5).

## 6.1.2 Heap Partitioning

Figure 8 shows that MAHJONG can alleviate the heap overpartitioning problem suffered by the allocation-site abstraction effectively for type-dependent clients. The allocation-site abstraction creates an average of 10073 objects per program, ranging from 6190 in luindex to 19529 in eclipse. In contrast, MAHJONG creates an average of 3826 objects per program, ranging from 2108 in luindex to 9414 in eclipse. This represents an average reduction of 62%.

Let us examine checkstyle in detail. As shown in Figure 8, a total of 10888 objects are created by the allocation site abstraction but only 4028 objects by MAHJONG.

Given the heap partitioned as $ \mathbb{H} /\equiv $ for checkstyle, Figure 9 relates the number of equivalence classes with a particular equivalence class size. In the left-most point marked by (1, 3769), for example, there are 3769 equivalence classes containing one object each. Thus, neither object is merged with any other objects.

Let us examine some equivalence classes, given in Table 1, with their ranks (measured in decreasing order of their sizes) shown as well. For StringBuilder (Row 1), all their objects are type-consistent (reaching only char[] objects

<div style='text-align: center;'><img src='assets/EK3N4IGF-fig-007.png' alt='OCR图片'/></div>

<div align="center">

Figure 8. Number of abstract objects created by the allocation-site abstraction and MAHJONG.

</div>

<div style='text-align: center;'><img src='assets/EK3N4IGF-fig-008.png' alt='OCR图片'/></div>

<div align="center">

Figure 9. Object merging in checkstyle.

</div>

<table border="1"><tr><td>Rank</td><td>Type</td><td>Equiv. Class Size</td><td>Total No. of Objects</td><td>Remarks</td></tr><tr><td>1</td><td>java.lang.StringBuilder</td><td>1303</td><td>1303</td><td>char[]</td></tr><tr><td>2</td><td>java.lang.Object[]</td><td>690</td><td>1353</td><td>String</td></tr><tr><td>12</td><td>antlr.ASTPair</td><td>108</td><td>109</td><td>DetailAST</td></tr><tr><td>55</td><td>java.lang.Object[]</td><td>12</td><td>1353</td><td>Integer</td></tr><tr><td>65</td><td>java.lang.Object[]</td><td>9</td><td>1353</td><td>QName</td></tr><tr><td>260</td><td>antlr.ASTPair</td><td>1</td><td>109</td><td>null</td></tr></table>

<div align="center">

Table 1. Some equivalence classes in checkstyle.

</div>

along any field access path) and thus merged. This is the largest equivalence class, corresponding to the right-most point marked by (1303,1) in Figure 9.

For some other types like Object[] (Rows 2,4 and 5), blindly merging all its objects would be imprecise (Section 2.1). In contrast, MAHJONG merges only typeconsistent objects in order to maximally preserve precision for type-dependent clients. Thus, MAHJONG ends up with different equivalent classes containing objects of type Object[] for storing objects of different types, such as String (Row 2), Integer (Row 4), and QName (Row 5).

Finally, we show that MAHJONG can also distinguish null from other objects, because null may affect precision as explained in Section 3.6. MAHJONG partitions 109 objects of ASTPair into two equivalence classes, with one containing 108 objects whose fields point to objects of type

DetailAST (Row 3) and the other that contains one single object with null fields (Row 6).

## 6.2 RQ2: MAHJONG-based Points-to Analysis

Mainstream points-to analyses for Java programs rely on the allocation-site-based abstraction to model the heap [20- 22, 39, 40, 42, 48]. We demonstrate experimentally that MAHJONG is a better alternative for type-dependent clients.

Concretely, we show that MAHJONG can achieve the following goal in the real world. Suppose a software developer intends to apply a points-to analysis to a program under a given time budget. MAHJONG opens up new opportunities for the developer to either accelerate the chosen points-to analysis or replace it with a more precise but more expensive points-to analysis under still the same budget.

## 6.2.1 Baselines and Metrics

We consider three types of context-sensitive points-to analyses: call-site-sensitivity (cs), object-sensitivity (obj) and type-sensitivity (type). Specifically, five points-to analyses in DOOP [14] are selected as baselines: 2cs (2-call-site-sensitive), 2obj (2-object-sensitive), 3obj (3-object-sensitive), 2type (2-type-sensitive), and 3type (3-type-sensitive). In principle, 2cs is not compatible with the others, $ 3\mathcal{A} $ is no less precise than $ 2\mathcal{A} $ , and kobj is no less precise than ktype. As for $ 1\mathcal{A} $ , it has been demonstrated that its precision is significantly less than that of $ k\mathcal{A} $ , where k >1 [20, 39]. As a result, $ 1\mathcal{A} $ is not used in the recent points-to analysis literature [15, 40, 48] and is thus omitted in our baselines.

Currently, each baseline $ k\mathcal{A} $ uses the allocation-site abstraction. M-kA denotes the version of $ k\mathcal{A} $ that uses the heap abstraction provided by MAHJONG. Thus, there are also five MAHJONG-based points-to analyses altogether.

The three type-dependent clients, call graph construction, devirtualization and may-fail casting, are widely used in the literature [20, 22, 39, 40, 48]. We consider the following metrics: the number of call graph edges (#call graph edges), the number of casting operations that may fail (#may-fail casts), and the number of virtual call sites that cannot be disambiguated into mono-calls (#poly call sites).

The time budget for each analysis is set to 5 hours.

## 6.2.2 Efficiency and Precision

Table 2 presents our results, showing clearly the effectiveness of MAHJONG in boosting existing points-to analyses while maintaining their precision for type-dependent clients.

For each program, five metrics are considered: "analysis time", "speedup", "#may-fail casts", "#poly call sites" and "#call graph edges". In all cases except "speedup", smaller is better. With "speedup" ignored, Table 2 contains 480 concrete results (=4 metrics $ \times $ 12 programs $ \times $ 10 points-to analyses (including the 5 baselines and 5 MAHJONG variants)).

In computing the speedup of M-k $ \mathcal{A} $ over k $ \mathcal{A} $ for a program, the pre-analysis time on the program is ignored. There are three reasons: (1) the points-to information produced by

<table border="1"><tr><td>Program</td><td>Pre-analysis</td><td>Metrics</td><td>2cs</td><td>M-2cs</td><td>2type</td><td>M-2type</td><td>3type</td><td>M-3type</td><td>2obj</td><td>M-2obj</td><td>3obj</td><td>M-3obj</td></tr><tr><td rowspan="4">antlr</td><td rowspan="4">ci:44.1sFPG:1.3sMAHJONG:1.3s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>2790.7</td><td>373.6</td><td>63.6</td><td>45.5</td><td>459.3</td><td>61.0</td><td>116.2</td><td>36.7</td><td>8302.0</td><td>69.9</td></tr><tr><td colspan="2">7.5X</td><td colspan="2">1.4X</td><td colspan="2">7.5X</td><td colspan="2">3.2X</td><td colspan="2">118.8X</td></tr><tr><td>888</td><td>888</td><td>648</td><td>649</td><td>599</td><td>600</td><td>524</td><td>524</td><td>463</td><td>463</td></tr><tr><td>1862</td><td>1862</td><td>1682</td><td>1685</td><td>1651</td><td>1654</td><td>1630</td><td>1633</td><td>1623</td><td>1626</td></tr><tr><td rowspan="4">fop</td><td rowspan="4">ci:34.7sFPG:0.7sMAHJONG:1.1s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>1510.3</td><td>430.5</td><td>66.1</td><td>46.6</td><td>526.9</td><td>67.8</td><td>73.8</td><td>36.7</td><td>8647.0</td><td>70.0</td></tr><tr><td colspan="2">3.5X</td><td colspan="2">1.4X</td><td colspan="2">7.8X</td><td colspan="2">2.0X</td><td colspan="2">123.5X</td></tr><tr><td>682</td><td>682</td><td>527</td><td>517</td><td>479</td><td>469</td><td>428</td><td>428</td><td>375</td><td>375</td></tr><tr><td>1068</td><td>1068</td><td>872</td><td>875</td><td>841</td><td>844</td><td>821</td><td>824</td><td>814</td><td>817</td></tr><tr><td rowspan="4">luindex</td><td rowspan="4">ci:26.2sFPG:0.8sMAHJONG:1.1s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>1480.2</td><td>301.9</td><td>45.4</td><td>30.1</td><td>526.4</td><td>42.8</td><td>72.9</td><td>28.0</td><td>10651.9</td><td>63.1</td></tr><tr><td colspan="2">4.9X</td><td colspan="2">1.5X</td><td colspan="2">12.3X</td><td colspan="2">2.6X</td><td colspan="2">168.8X</td></tr><tr><td>701</td><td>701</td><td>522</td><td>513</td><td>473</td><td>464</td><td>413</td><td>413</td><td>358</td><td>358</td></tr><tr><td>1157</td><td>1157</td><td>981</td><td>984</td><td>946</td><td>949</td><td>922</td><td>925</td><td>915</td><td>918</td></tr><tr><td rowspan="4">pmd</td><td rowspan="4">ci:44.8sFPG:1.4sMAHJONG:1.5s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>2099.4</td><td>547.6</td><td>92.2</td><td>62.2</td><td>906.1</td><td>82.9</td><td>145.1</td><td>82.3</td><td>14469.3</td><td>127.7</td></tr><tr><td colspan="2">3.8X</td><td colspan="2">1.5X</td><td colspan="2">10.9X</td><td colspan="2">1.8X</td><td colspan="2">113.3X</td></tr><tr><td>1319</td><td>1319</td><td>1082</td><td>1072</td><td>1014</td><td>1004</td><td>930</td><td>930</td><td>871</td><td>871</td></tr><tr><td>1424</td><td>1424</td><td>1210</td><td>1213</td><td>1175</td><td>1179</td><td>1137</td><td>1140</td><td>1130</td><td>1133</td></tr><tr><td rowspan="4">bloat</td><td rowspan="4">ci:37.7sFPG:2.4sMAHJONG:1.9s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>7769.3</td><td>5350.9</td><td>87.2</td><td>67.3</td><td>533.6</td><td>124.5</td><td>3611.9</td><td>3501.5</td><td>&gt;5h</td><td>&gt;5h</td></tr><tr><td colspan="2">1.5X</td><td colspan="2">1.3X</td><td colspan="2">4.3X</td><td colspan="2">1.03X</td><td colspan="2">-</td></tr><tr><td>1840</td><td>1840</td><td>1614</td><td>1608</td><td>1521</td><td>1515</td><td>1302</td><td>1302</td><td>-</td><td>-</td></tr><tr><td>2005</td><td>2005</td><td>1811</td><td>1814</td><td>1673</td><td>1676</td><td>1567</td><td>1571</td><td>-</td><td>-</td></tr><tr><td rowspan="4">chart</td><td rowspan="4">ci:89.6sFPG:2.3sMAHJONG:4.0s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>5476.2</td><td>1665.9</td><td>174.0</td><td>86.8</td><td>2967.8</td><td>518.5</td><td>997.9</td><td>279.8</td><td>&gt;5h</td><td>&gt;5h</td></tr><tr><td colspan="2">3.3X</td><td colspan="2">2.0X</td><td colspan="2">5.7X</td><td colspan="2">3.6X</td><td colspan="2">-</td></tr><tr><td>2093</td><td>2093</td><td>1708</td><td>1699</td><td>1621</td><td>1612</td><td>1349</td><td>1349</td><td>-</td><td>-</td></tr><tr><td>2475</td><td>2475</td><td>2093</td><td>2096</td><td>2036</td><td>2039</td><td>2017</td><td>2020</td><td>-</td><td>-</td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td rowspan="4">checkstyle</td><td rowspan="4">ci:66.6sFPG:3.0sMAHJONG:3.1s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>7644.8</td><td>3186.7</td><td>187.8</td><td>92.3</td><td>5120.6</td><td>379.8</td><td>1946.6</td><td>277.1</td><td>&gt;5h</td><td>3103.7</td></tr><tr><td colspan="2">2.4X</td><td colspan="2">2.0X</td><td colspan="2">13.5X</td><td colspan="2">7.0X</td><td colspan="2">∞</td></tr><tr><td>1596</td><td>1601</td><td>1345</td><td>1334</td><td>1243</td><td>1231</td><td>1135</td><td>1140</td><td>-</td><td>1022</td></tr><tr><td>2558</td><td>2558</td><td>2307</td><td>2311</td><td>2239</td><td>2243</td><td>2211</td><td>2215</td><td>-</td><td>2168</td></tr><tr><td rowspan="4">xalan</td><td rowspan="4">ci:38.7sFPG:1.2sMAHJONG:1.7s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>1996.1</td><td>464.4</td><td>99.0</td><td>57.7</td><td>1122.5</td><td>101.8</td><td>1816.8</td><td>247.3</td><td>&gt;5h</td><td>1274.9</td></tr><tr><td colspan="2">4.3X</td><td colspan="2">1.7X</td><td colspan="2">11.0X</td><td colspan="2">7.3X</td><td colspan="2">∞</td></tr><tr><td>982</td><td>982</td><td>794</td><td>784</td><td>740</td><td>730</td><td>589</td><td>589</td><td>-</td><td>535</td></tr><tr><td>1879</td><td>1879</td><td>1651</td><td>1654</td><td>1620</td><td>1623</td><td>1595</td><td>1598</td><td>-</td><td>1591</td></tr><tr><td rowspan="4">lusearch</td><td rowspan="4">ci:41.4sFPG:0.8sMAHJONG:1.0s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>1444.7</td><td>309.4</td><td>46.4</td><td>29.6</td><td>780.9</td><td>44.5</td><td>110.2</td><td>27.8</td><td>&gt;5h</td><td>65.0</td></tr><tr><td colspan="2">4.7X</td><td colspan="2">1.6X</td><td colspan="2">17.5X</td><td colspan="2">4.0X</td><td colspan="2">∞</td></tr><tr><td>779</td><td>779</td><td>561</td><td>552</td><td>514</td><td>505</td><td>424</td><td>424</td><td>-</td><td>372</td></tr><tr><td>1361</td><td>1361</td><td>1178</td><td>1181</td><td>1147</td><td>1150</td><td>1120</td><td>1123</td><td>-</td><td>1116</td></tr><tr><td rowspan="4">JPC</td><td rowspan="4">ci:58.9sFPG:2.1sMAHJONG:4.5s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>3464.1</td><td>1155.1</td><td>147.1</td><td>90.6</td><td>1509.8</td><td>340.5</td><td>477.2</td><td>306.0</td><td>&gt;5h</td><td>5056.8</td></tr><tr><td colspan="2">3.0X</td><td colspan="2">1.6X</td><td colspan="2">4.4X</td><td colspan="2">1.6X</td><td colspan="2">∞</td></tr><tr><td>1828</td><td>1828</td><td>1595</td><td>1579</td><td>1507</td><td>1490</td><td>1381</td><td>1381</td><td>-</td><td>1226</td></tr><tr><td>4749</td><td>4749</td><td>4379</td><td>4382</td><td>4321</td><td>4324</td><td>4275</td><td>4279</td><td>-</td><td>4139</td></tr><tr><td rowspan="4">findbugs</td><td rowspan="4">ci:90.6sFPG:4.6sMAHJONG:3.2s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>2923</td><td>2928</td><td>2469</td><td>2458</td><td>1507</td><td>1490</td><td>1381</td><td>1381</td><td>-</td><td>1226</td></tr><tr><td>4136</td><td>4136</td><td>3753</td><td>3756</td><td>-</td><td>3574</td><td>-</td><td>3565</td><td>-</td><td>3534</td></tr><tr><td>100046</td><td>100063</td><td>89036</td><td>89054</td><td>-</td><td>87581</td><td>-</td><td>87929</td><td>-</td><td>86985</td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td rowspan="4">eclipse</td><td rowspan="4">ci:174.1sFPG:15.5sMAHJONG:21.4s</td><td rowspan="4">analysis time (sec.) speedup#may-fail casts#poly call sites#call graph edges</td><td>2523</td><td>2928</td><td>2469</td><td>2458</td><td>-</td><td>2143</td><td>-</td><td>2074</td><td>-</td><td>1671</td></tr><tr><td>4136</td><td>4136</td><td>3753</td><td>3756</td><td>-</td><td>3574</td><td>-</td><td>3565</td><td>-</td><td>3534</td></tr><tr><td>100046</td><td>100063</td><td>89036</td><td>89054</td><td>-</td><td>87581</td><td>-</td><td>87929</td><td>-</td><td>86985</td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table>

<div align="center">

Table 2. Efficiency and precision metrics for all programs and analyses with and without MAHJONG. In all cases (except speedup), lower is better. Symbol $ \infty $ is used in speedup when a baseline analysis is not scalable but MAHJONG is scalable.

</div>

"ci" in Table 2 may already exist and can be reused, (2) the pre-analysis time is relatively small (compared to the analysis time of a subsequent $ M-k\mathcal{A} $), and (3) the pre-analysis will be used to drive many points-to analyses.

Improved Efficiency MAHJONG is versatile enough in accelerating all the five points-to analyses with three different types of context-sensitivity. For every program where M-kA is scalable, a speedup over kA is obtained.

MAHJONG is highly effective in boosting performance. For the programs where both kA and M-kA are scalable, MAHJONG achieves an average speedup of 15.4X (ranging from 1.03X by M-2obj/2obj for bloat to 168.8X by M-3obj/3obj for luindex). Table 2 divides visually the 12 programs into two groups. For the top six, kA scales whenever M-kA scales. However, M-kA is faster than kA, achieving an average speedup of 22.2X. This is especially significantly for the most-precise configuration M-3obj/3obj. For every program in the bottom six, MAHJONG enables using a more precise points-to analysis that is not scalable if the allocation-site abstraction is used instead.

Preserved Precision For every program, as shown in Table 2, MAHJONG achieves nearly the same precision for every client under every configuration $ M-k\mathcal{A}/k\mathcal{A}. $ Thus, merging type-consistent objects can maximally preserve precision as discussed in Section 3.6 and validated here.

Call-Site-Sensitivity M-2cs is no more precise than 2cs in principle (Section 3.6) but nearly as precise in practice For devirtualization, M-2cs is equally as precise as 2cs For may-fail casting, M-2cs is negligibly worse than 2cs (with an average precision loss of 0.04%) , by reporting only 5 more may-fail casts each in checkstyle and findbugs. For call graph construction, M-2cs is also marginally worse (with an average precision loss of 0.006%) , by including only a few extra edges in pmd (3), chart (14), checkstyle (20), and findbugs (17).

Object-Sensitivity M-kobj is also no more precise than kobj in principle (Section 3.6) but nearly as precise in practice. For call graph construction, devirtualization and may-fail casting, M-2obj experiences a small loss of precision of 0.02% , 0.23% and 0.04% over 2obj, respectively, on average. For M-3obj over 3obj, these percentages are 0.02% , 0.29% and 0.00% , respectively. For mayfail casting, M-2obj is on a par with 2obj if checkstyle is ignored, and M-3obj is equally as precise as 3obj.

Type-Sensitivity M-ktype may lose or gain precision compared with ktype, as discussed in Section 3.6. For mayfail casting, M-ktype is slightly more precise than ktype in all the programs except antlr. The average precision gains for M-2type/2type and M-3type/3type are 0.91% and 1.11%, respectively. For the other two clients, M-ktype is slightly less precise than ktype in every program. For call graph construction and devirtualization, M-2type experiences a small loss of precision of 0.02% and 0.18%

over 2type, respectively. In the case of M-3type/3type these percentages are 0.02% and 0.22% ,respectively.

Importance of Context-Sensitivity Context-sensitivity is significant for improving the precision of type-dependent clients, measured by #may-fail casts, #poly call sites and #call graph edges, in Table 2. Without context-sensitivity, #may-fail casts, #poly call sites and #call graph edges will be 2027, 3122 and 75162, respectively, on average, across all the programs. With context-sensitivity (by using the most precise MAHJONG-based points-to analysis for each program, e.g., M-3obj for ant1r and M-2obj for chart), these numbers become substantially smaller: 1101, 2530 and 63994. This demonstrates convincingly the necessity of embracing context-sensitivity even for type-dependent clients.

## 6.2.3 Discussion

We discuss two observations about some results in Table 2.

Speedups of M-3obj over 3obj MAHJONG is most impressive in scaling 3obj, the most precise baseline used. For the four programs, antlr, fop, luindex and pmd, where 3obj is scalable, M-3obj is 131X faster, on average, while achieving nearly the same precision for all the three clients. For the remaining eight, where 3obj is unscalable, M-3obj is scalable for checkstyle, xalan, lusearch, JPC and fingbugs, by spending an average of 33.42 minutes only.

Why does M-3obj/3obj deliver significantly better speedups than M-2obj/2obj? By using one extra level of context elements than 2obj, 3obj often incurs an exponential growth in the number of contexts used. By merging typeconsistent objects, which happen to be used as context elements at this extra level in 3obj, M-3obj can drastically reduce the number of contexts used and thus accelerate the analysis. Consider luindex, where the speedup achieved by M-3obj/3obj is the highest obtained. The number of context-sensitive points-to relations produced under 2obj is 9,255,034 but grows to 191,160,483 under 3obj, which are both reduced significantly to 4,256,310 under M-3obj.

Unscalability of MAHJONG-based Points-to Analyses As shown in Table 2, M-2cs is unscalable for eclipse and M-3obj is unscalable for bloat, chart and eclipse. Why is M-3obj scalable for some large programs such as findbugs but unscalable for some small ones such as bloat? As shown in Figure 8, MAHJONG creates 5233 objects for findbugs but only 3107 objects for bloat.

M-3obj is unscalable for bloat possibly due to its object structure used. Some methods are both invoked on many (abstract) receiver objects and allocate many objects. Thus, the number of contexts becomes extremely large. To alleviate this problem, one solution is to use a coarser relation than given in Definition 2.1 so that more objects can be merged together. Another solution is to apply 3obj only selectively to parts of the program when moving from 2obj to 3obj.

## 7. Related Work

We review only the work most closely related to (whole program) points-to analysis for object-oriented programs.

Points-to Analysis Context-sensitivity is essential in achieving good efficiency and precision trade-offs for Java programs [22, 23, 38, 41, 44]. There are three main flavors: call-site-sensitivity, object-sensitivity, and type-sensitivity.

Call-site-sensitivity [15, 22, 36, 42, 51], i.e., k-CFA [37] is often used to analyze C programs [6, 33, 45, 46, 52]. To better exploit the object-oriented features in Java, object-sensitivity is proposed [29, 30], yielding significantly higher precision at usually less cost [15, 20, 22, 48]. However, for large Java programs, object-sensitivity is often unscalable despite its good precision. To trade precision for efficiency, type-sensitivity is thus introduced [39].

For type-dependent clients, MAHJONG represents a better alternative than the allocation-site abstraction for the three types of context-sensitivity. This benefit is expected to generalize to other variations of context-sensitivity [20, 48].

Heap Abstraction There are mainly two types of models in static analysis: store-based, e.g., the allocation-site abstraction and storeless, e.g., access paths [19]. The former is usually adopted in points-to analysis and the latter in alias analysis [38]. We focus on store-based models for Java here.

There are other ways to improve the efficiency of pointsto analysis. In [40], empirical heuristics are used to make efficiency and precision trade-offs. As a result, some parts of the program are analyzed context-sensitively and some other parts are analyzed context-insensitively.

Due to its good precision, the allocation-site abstraction is adopted by (whole-program) points-to analysis techniques in the literature [20, 21, 30, 39, 40, 42, 48] and tools, such as CHORD [10], DOOP [14], SOOT [49] and WALA [50].

The allocation-type abstraction (with one abstract object per type) was used earlier to resolve virtual calls [35, 47]. It is reasonably precise, compared with 0-CFA [37] and CHA [13], which are fast but imprecise. Currently, points-to analysis no longer relies on the allocation-type abstraction to model the heap, as it is imprecise [19, 38, 51].

Liang and Naik [27] introduce a sophisticated allocation-type-based abstraction in a pre-pruning analysis to scale a subsequent refinement analysis to answer some queries effectively. An allocation site h is represented by its dynamic type and the type containing h. Unlike MAHJONG, however, such an abstraction is still not precise for points-to analysis.

## 8. Conclusion and Future Work

as bug detection, security analysis, program verification and program understanding, where call graphs are required.

We have introduced MAHJONG, a novel technique for abstracting the heap to scale significantly points-to analyses for object-oriented programs while maximally preserving their precision for an important class of type-dependent clients, including call graph construction. MAHJONG is expected to provide significant benefits to many program analyses, such

This work opens up a number of research directions on providing suitable heap abstractions for points-to analysis for large codebases and addressing their interplay. First, our notion of type-consistency may be overly restrictive for some other clients and can be relaxed. Second, as there are little benefits to analyze merged objects context-sensitively for type-dependent clients, it may be worthwhile investigating how to enforce selective context-sensitivity systematically by exploiting this insight. Third, how do we adaptively refine a MAHJONG-like heap abstraction to support demand queries? Finally, it will be interesting to combine MAHJONG and a storeless heap abstraction to support points-to analysis.

## Acknowledgments

We would like to thank our shepherd, Prof. Jeff Foster, and the anonymous reviewers for their valuable feedback on an earlier draft of this paper. This research has been supported by ARC grants, DP150102109 and DP170103956.

## References

[1] J. Adamek and V. Trnkova. Automata and Algebras in Categories. Kluwer Academic Publishers, 1990.

[2] A. V. Aho, M. S. Lam, R. Sethi, and J. D. Ullman. Compilers: Principles, Techniques, and Tools (2Nd Edition). Addison-Wesley, Boston, MA, USA, 2006.

[3] K. Ali and O. Lhoták. Averroes: Whole-program analysis without the whole program. ECOOP, pages 378-400, 2013.

[4] L. Andersen. Program analysis and specialization for the C programming language. PhD thesis, DIKU, University of Copenhagen, 1994.

[5] S. Arzt, S. Rasthofer, C. Fritz, E. Bodden, A. Bartel, J. Klein, Y. Le Traon, D. Octeau, and P. McDaniel. FlowDroid: Precise context, flow, field, object-sensitive and lifecycle-aware taint analysis for Android apps. PLDI, pages 259-269, 2014.

[6] S. Blackshear, B.-Y. E. Chang, and M. Sridharan. Selective control-flow abstraction via jumping. OOPSLA, pages 163- 182, 2015.

[7] S. Blackshear, A. Gendreau, and B.-Y. E. Chang. Droidel: A general approach to Android framework modeling. SOAP, pages 19-25, 2015.

[8] E. Bodden, A. Sewe, J. Sinschek, H. Oueslati, and M. Mezini. Taming reflection: Aiding static analysis in the presence of reflection and custom class loaders. ICSE, pages 241-250, 2011.

[9] M. Bravenboer and Y. Smaragdakis. Strictly declarative specification of sophisticated points-to analyses. OOPSLA, pages 243-262, 2009.

[10] Chord. A program analysis platform for Java. http://www. cis.upenn.edu/~mhnaik/chord.html.

[11] T. H. Cormen, C. E. Leiserson, R. L. Rivest, and C. Stein. Introduction to Algorithms. The MIT Press, 2009.

[12] DaCapo. Java benchmark. http://www.dacapobench.org.

[13] J. Dean, D. Grove, and C. Chambers. Optimization of object-oriented programs using static class hierarchy analysis. ECOOP, pages 77-101, 1995.

[14] DOOP. A sophisticated framework for Java pointer analysis. http://doop.program-analysis.org.

[15] Y. Feng, X. Wang, I. Dillig, and T. Dillig. Bottom-up context-sensitive pointer analysis for Java. APLAS, pages 465-484, 2015.

[16] S. J. Fink, E. Yahav, N. Dor, G. Ramalingam, and E. Geay. Effective typestate verification in the presence of aliasing. ACM Trans. Softw. Eng. Methodol., 17(2), 2008.

[17] M. Hind. Pointer analysis: Haven't we solved this problem yet? PASTE, pages 54-61, 2001.

[18] J. E. Hopcroft and R. M. Karp. A linear algorithm for testing equivalence of finite automata. Technical Report 71-114, Cornell University, 1971.

[19] V. Kanvar and U. P. Khedker. Heap abstractions for static analysis. ACM Comput. Surv., 49(2):29:1-29:47, 2016.

[20] G. Kastrinis and Y. Smaragdakis. Hybrid context-sensitivity for points-to analysis. PLDI, pages 423-434, 2013.

[21] O. Lhoták and L. Hendren. Scaling Java points-to analysis using Spark. CC, pages 153-169, 2003.

[22] O. Lhoták and L. Hendren. Context-sensitive points-to analysis: is it worth it? CC, pages 47-64, 2006.

[23] O. Lhoták and L. Hendren. Evaluating the benefits of context-sensitive points-to analysis using a bdd-based implementation. ACM TOSEM., 18(1):3:1-3:53, 2008.

[24] Y. Li, T. Tan, Y. Sui, and J. Xue. Self-inferencing reflection resolution for Java. ECOOP, pages 27-53, 2014.

[25] Y. Li, T. Tan, and J. Xue. Effective soundness-guided reflection analysis. SAS, pages 162-180, 2015.

[26] Y. Li, T. Tan, Y. Zhang, and J. Xue. Program tailoring: Slicing by sequential criteria. ECOOP, pages 15:1-15:27, 2016.

[27] P. Liang and M. Naik. Scaling abstraction refinement via pruning. PLDI, pages 590-601, 2011.

[28] A. Marino. Analysis and Enumeration: Algorithms for Biological Graphs. Atlantis Publishing Corporation, 2015.

[29] A. Milanova, A. Rountev, and B. G. Ryder. Parameterized object sensitivity for points-to and side-effect analyses for Java. ISSTA, pages 1-11, 2002.

[30] A. Milanova, A. Rountev, and B. G. Ryder. Parameterized object sensitivity for points-to analysis for Java. ACM Trans. Softw. Eng. Methodol., 14(1):1-41, 2005.

[31] M. Naik, A. Aiken, and J. Whaley. Effective static race detection for Java. PLDI, pages 308-319, 2006.

[32] M. Naik, C. Park, K. Sen, and D. Gay. Effective static deadlock detection. ICSE, pages 386-396, 2009.

[33] H. Oh, W. Lee, K. Heo, H. Yang, and K. Yi. Selective context-sensitivity guided by impact pre-analysis. PLDI, pages 475- 484, 2014.

[34] R. C. Read and R. E. Tarjan. Bounds on backtrack algorithms for listing cycles, paths, and spanning trees. Networks, 5(3): 237-252, 1975.

[35] B. G. Ryder. Dimensions of precision in reference analysis of object-oriented programming languages. CC, pages 126-137, 2003.

[36] L. Shang, X. Xie, and J. Xue. On-demand dynamic summarybased points-to analysis. In CGO, pages 264-274, 2012.

[37] O. G. Shivers. Control-flow Analysis of Higher-order Languages of Taming Lambda. PhD thesis, 1991.

[38] Y. Smaragdakis and G. Balatsouras. Pointer analysis. Found. Trends Program. Lang., pages 1-69, 2015.

[39] Y. Smaragdakis, M. Bravenboer, and O. Lhoták. Pick your contexts well: understanding object-sensitivity. POPL, pages 17-30, 2011.

[40] Y. Smaragdakis, G. Kastrinis, and G. Balatsouras. Introspective analysis: Context-sensitivity, across the board. PLDI, pages 485-495, 2014.

[41] J. Späth, L. N. Q. Do, K. Ali, and E. Bodden. Boomerang: Demand-driven flow- and context-sensitive pointer analysis for Java. ECOOP, pages 22:1-22:26, 2016.

[42] M. Sridharan and R. Bodík. Refinement-based context-sensitive points-to analysis for Java. PLDI, pages 387-400, 2006.

[43] M. Sridharan, S. J. Fink, and R. Bodik. Thin slicing. PLDI, pages 112-122, 2007.

[44] M. Sridharan, S. Chandra, J. Dolby, S. J. Fink, and E. Yahav. Aliasing in object-oriented programming. chapter Alias Analysis for Object-oriented Programs, pages 196-232. 2013.

[45] Y. Sui and J. Xue. On-demand strong update analysis via value-flow refinement. In FSE, pages 460-473, 2016.

[46] Y. Sui, Y. Li, and J. Xue. Query-directed adaptive heap cloning for optimizing compilers. CGO, pages 1-11, 2013.

[47] V. Sundaresan, L. Hendren, C. Razafimahefa, R. Vallée-Rai, P. Lam, E. Gagnon, and C. Godin. Practical virtual method call resolution for java. OOPSLA, pages 264-280, 2000.

[48] T. Tan, Y. Li, and J. Xue. Making k-object-sensitive pointer analysis more precise with still k-limiting. SAS, pages 489- 510, 2016.

[49] R. Vallée-Rai, P. Co, E. Gagnon, L. Hendren, P. Lam, and V. Sundaresan. Soot - a Java bytecode optimization framework. CASCON, pages 1-13, 1999.

[50] WALA. Watson libraries for analysis. wala.sf.net.

[51] J. Whaley and M. S. Lam. Cloning-based context-sensitive pointer alias analysis using binary decision diagrams. PLDI, pages 131-144, 2004.

[52] H. Yu, J. Xue, W. Huo, X. Feng, and Z. Zhang. Level by level: making flow- and context-sensitive pointer analysis scalable for millions of lines of code. CGO, pages 218-229, 2010.

[53] Q. Zhang and Z. Su. Context-sensitive data-dependence analysis via linear conjunctive language reachability. POPL, pages 344-358, 2017.

[54] X. Zhang, R. Mangal, R. Grigore, M. Naik, and H. Yang. On abstraction refinement for program analyses in Datalog. PLDI, pages 239-248, 2014.

[55] Y. Zhang, T. Tan, Y. Li, and J. Xue. Ripple: Reflection analysis for android apps in incomplete information environments. 2017.