import logging
import re

from nltk.stem import PorterStemmer
from rank_bm25 import BM25Okapi, BM25Plus
from rich import print

from .data_models import SearchPairs

LOGGER = logging.getLogger(__name__)

STOPWORDS = {
    "was",
    "and",
    "wasn",
    "about",
    "doing",
    "further",
    "most",
    "m",
    "up",
    "more",
    "shan",
    "him",
    "which",
    "t",
    "his",
    "an",
    "will",
    "ours",
    "because",
    "aren",
    "need",
    "how",
    "what",
    "but",
    "me",
    "such",
    "ll",
    "under",
    "hadn",
    "your",
    "being",
    "very",
    "at",
    "y",
    "ve",
    "yours",
    "ma",
    "might",
    "when",
    "on",
    "won",
    "between",
    "own",
    "myself",
    "shall",
    "a",
    "are",
    "could",
    "down",
    "ought",
    "their",
    "some",
    "just",
    "o",
    "same",
    "too",
    "do",
    "the",
    "above",
    "did",
    "can",
    "i",
    "any",
    "be",
    "does",
    "didn",
    "as",
    "given",
    "they",
    "don",
    "himself",
    "needn",
    "its",
    "may",
    "via",
    "doesn",
    "were",
    "couldn",
    "with",
    "all",
    "she",
    "you",
    "from",
    "both",
    "hasn",
    "not",
    "d",
    "in",
    "other",
    "that",
    "he",
    "below",
    "herself",
    "now",
    "am",
    "ain",
    "by",
    "there",
    "if",
    "isn",
    "through",
    "dare",
    "wouldn",
    "re",
    "been",
    "once",
    "haven",
    "it",
    "why",
    "again",
    "is",
    "had",
    "yourselves",
    "theirs",
    "until",
    "nor",
    "her",
    "having",
    "or",
    "only",
    "of",
    "then",
    "no",
    "mustn",
    "who",
    "during",
    "into",
    "yourself",
    "them",
    "ourselves",
    "our",
    "would",
    "mightn",
    "return",
    "before",
    "whom",
    "these",
    "than",
    "we",
    "to",
    "so",
    "over",
    "has",
    "those",
    "should",
    "for",
    "this",
    "themselves",
    "after",
    "while",
    "itself",
    "s",
    "shouldn",
    "each",
    "my",
    "hers",
    "against",
    "here",
    "weren",
    "out",
    "off",
    "few",
    "have",
    "where",
}


class BM25SearchEngine:
    def __init__(self, search_corpus: SearchPairs, use_okapi: bool = True):
        LOGGER.info("Initilizing bm25 search engine")

        self.search_corpus = search_corpus
        self.stemmer = PorterStemmer()
        self.tokenized_corpus: list = []
        if use_okapi:
            self.bm25_engine = self.build_bm25okapi_search_corpus()
        else:
            self.bm25_engine = self.build_bm25plus_search_corpus()

    def _process_tokens(self, text: str) -> str:
        """Handle snake_case, pipes, CamelCase, and acronyms like TR069."""
        text = re.sub(r"[_|/\\]", " ", text)  # snake_case → words
        text = re.sub(
            r"([A-Z]+)([A-Z][a-z])", r"\1 \2", text
        )  # ACRONYMWord → ACRONYM Word
        text = re.sub(r"([a-z\d])([A-Z])", r"\1 \2", text)  # camelCase → camel Case
        text = text.lower()
        text = re.sub(r"[^a-z0-9\s]", "", text)  # strip punctuation
        return text

    def tokenize(self, text: str) -> list[str]:
        text = self._process_tokens(text)
        tokens = text.split()
        tokens = [t for t in tokens if t not in STOPWORDS and len(t) > 2]
        tokens = [self.stemmer.stem(t) for t in tokens]
        return tokens

    def build_doc(self, row: str) -> list[str]:
        # name repeated twice — gives it more weight without touching BM25 internals
        f_name = row.split("|")[0]
        return self.tokenize(f_name) + self.tokenize(row)

    def build_bm25plus_search_corpus(self) -> BM25Plus:
        tokenized_corpus = [self.build_doc(row) for row in self.search_corpus.documents]
        self.tokenized_corpus = tokenized_corpus
        return BM25Plus(tokenized_corpus, k1=1.2, b=0.4, delta=1.0)

    def build_bm25okapi_search_corpus(self) -> BM25Okapi:
        tokenized_corpus = [self.build_doc(row) for row in self.search_corpus.documents]
        self.tokenized_corpus = tokenized_corpus
        return BM25Okapi(tokenized_corpus, k1=1.2, b=0.4)

    def search(self, query: str, top_k: int = 5) -> list[tuple[int, float]]:
        tokens = self.tokenize(query)
        scores = self.bm25_engine.get_scores(tokens)
        # ranked = sorted(zip(self.search_corpus.keys, scores), key=lambda x: -x[1])[:9]
        ranked = sorted(
            enumerate(scores), key=lambda x: -x[1]
        )[
            :top_k
        ]  # -x[1]  nagative fliping the value so in number lin 91 becode -91  sorting becomes decending
        ranked = [(idx, score) for idx, score in ranked if score > 0]
        print(f"\nQuery: '{query}'  →  ranked: {[r[0] for r in ranked]}")
        return ranked

    def stopword_finder(self) -> None:
        from collections import Counter

        df: Counter = Counter()
        for doc_tokens in self.tokenized_corpus:
            for token in set(doc_tokens):  # unique per doc
                df[token] += 1

        total = len(self.tokenized_corpus)
        # Words in more than 40% of documents — these discriminate poorly
        candidates = [(w, c / total) for w, c in df.items() if c / total > 0.4]
        candidates.sort(key=lambda x: -x[1])
        print(candidates)
