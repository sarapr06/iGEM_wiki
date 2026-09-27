import React from "react"
import WikiLayout from "../components/layout.js"
import { HomeScrollPrototype } from "../components/HomeScrollPrototype.js"

const HomeScrollPrototypePage = () => (
  <WikiLayout fullBleed hideTopBar hideLoader>
    <HomeScrollPrototype />
  </WikiLayout>
)

export default HomeScrollPrototypePage

export const Head = () => <title>Home scroll prototype — iGEM Toronto 2026</title>
